import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Meeting } from '@prisma/client';
import { BotLauncherService } from '../bot/bot-launcher.service';
import { BotRegistryService } from '../bot/bot-registry.service';
import { ReportingService } from '../reporting/reporting.service';

const JOIN_EARLY_MS = 60 * 1000;
const JOIN_GRACE_MS = 2 * 60 * 1000;
const TRACKABLE_STATUSES = ['scheduled', 'joining', 'in_progress'];
// Instances missing this long are treated as dead and reclaimed (3 missed 30s heartbeats).
const INSTANCE_STALE_MS = 90 * 1000;

@Injectable()
export class MeetingLifecycleService {
  private readonly logger = new Logger(MeetingLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botLauncher: BotLauncherService,
    private readonly registry: BotRegistryService,
    private readonly reporting: ReportingService,
  ) {}

  async runTick(): Promise<void> {
    const now = new Date();

    const meetings = await this.prisma.meeting.findMany({
      where: { assistantStatus: { in: TRACKABLE_STATUSES } },
      select: { id: true, assistantStatus: true, startTime: true, endTime: true, meetLink: true },
    });

    const toJoining: Array<{ id: string; meetLink: string | null }> = [];
    const toInProgress: string[] = [];
    const toProcessing: string[] = [];

    for (const m of meetings) {
      if (m.assistantStatus === 'scheduled' && new Date(m.startTime.getTime() - JOIN_EARLY_MS) <= now && m.endTime > now) {
        toJoining.push({ id: m.id, meetLink: m.meetLink });
      } else if (m.assistantStatus === 'joining' && m.endTime <= now) {
        // Meeting ended while bot was still joining — stop immediately
        toProcessing.push(m.id);
      } else if (
        m.assistantStatus === 'joining' &&
        new Date(m.startTime.getTime() + JOIN_GRACE_MS) <= now &&
        m.endTime > now
      ) {
        toInProgress.push(m.id);
      } else if (m.assistantStatus === 'in_progress' && m.endTime <= now) {
        toProcessing.push(m.id);
      }
    }

    const joiningIds = toJoining.map((m) => m.id);

    const transitions: Array<{ ids: string[]; status: string }> = [
      { ids: joiningIds, status: 'joining' },
      { ids: toInProgress, status: 'in_progress' },
      { ids: toProcessing, status: 'processing' },
    ];

    let total = 0;
    for (const { ids, status } of transitions) {
      if (ids.length === 0) continue;
      await this.prisma.meeting.updateMany({
        where: { id: { in: ids } },
        data: { assistantStatus: status },
      });
      total += ids.length;
    }

    if (total > 0) {
      this.logger.log(`Lifecycle tick: ${total} transition(s) applied`);
    }

    // Free instances whose meeting ended long ago or whose bot stopped heart-beating.
    await this.reapInstances(now);

    // Launch newly-joining meetings, plus retry any still waiting for a free bot.
    const alreadyJoining = meetings
      .filter(
        (m) =>
          m.assistantStatus === 'joining' &&
          !toInProgress.includes(m.id) &&
          !toProcessing.includes(m.id),
      )
      .map((m) => ({ id: m.id, meetLink: m.meetLink }));
    const relaunchable = await this.selectRelaunchable(alreadyJoining);

    for (const { id, meetLink } of [...toJoining, ...relaunchable]) {
      if (meetLink) void this.botLauncher.launch(id, meetLink);
    }

    for (const id of toProcessing) {
      void this.botLauncher.stop(id);
      void this.reporting.generateForMeeting(id);
    }
  }

  /** Meetings still 'joining' whose bot job is queued/failed (or missing) — retry them. */
  private async selectRelaunchable(
    meetings: Array<{ id: string; meetLink: string | null }>,
  ): Promise<Array<{ id: string; meetLink: string | null }>> {
    if (meetings.length === 0) return [];
    const jobs = await this.prisma.botJob.findMany({
      where: { meetingId: { in: meetings.map((m) => m.id) } },
      select: { meetingId: true, status: true },
    });
    const statusByMeeting = new Map(jobs.map((j) => [j.meetingId, j.status]));
    const relaunch = new Set(['queued', 'failed']);
    return meetings.filter((m) => {
      const status = statusByMeeting.get(m.id);
      return status === undefined || relaunch.has(status);
    });
  }

  /** Release stuck bot-instance assignments and mark dead instances offline. */
  private async reapInstances(now: Date): Promise<void> {
    await this.registry.markStaleOffline(INSTANCE_STALE_MS);

    const busy = await this.prisma.botInstance.findMany({
      where: { currentMeetingId: { not: null } },
      select: { id: true, currentMeetingId: true, lastHeartbeatAt: true },
    });
    if (busy.length === 0) return;

    const meetings = await this.prisma.meeting.findMany({
      where: { id: { in: busy.map((b) => b.currentMeetingId as string) } },
      select: { id: true, endTime: true },
    });
    const meetingById = new Map(meetings.map((m) => [m.id, m]));
    const staleCutoff = new Date(now.getTime() - INSTANCE_STALE_MS);

    for (const inst of busy) {
      const meetingId = inst.currentMeetingId as string;
      const meeting = meetingById.get(meetingId);
      const endedLongAgo = meeting ? meeting.endTime < staleCutoff : false;
      const heartbeatStale = !inst.lastHeartbeatAt || inst.lastHeartbeatAt < staleCutoff;
      if (!meeting || endedLongAgo || heartbeatStale) {
        await this.registry.release(meetingId);
        this.logger.warn(`Reaped bot instance ${inst.id} from meeting ${meetingId}`);
      }
    }
  }

  async getDashboardMeetings(userId: string): Promise<Meeting[]> {
    return this.prisma.meeting.findMany({
      where: { userId, assistantStatus: { not: 'none' } },
      orderBy: { startTime: 'desc' },
    });
  }

  async markFailed(userId: string, meetingId: string): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!meeting) throw new NotFoundException('Meeting not found');

    return this.prisma.meeting.update({
      where: { id: meetingId },
      data: { assistantStatus: 'failed' },
    });
  }
}
