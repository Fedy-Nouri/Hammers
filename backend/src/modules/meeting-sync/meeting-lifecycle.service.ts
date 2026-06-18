import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Meeting } from '@prisma/client';
import { BotLauncherService } from '../bot/bot-launcher.service';

const JOIN_GRACE_MS = 2 * 60 * 1000;
const TRACKABLE_STATUSES = ['scheduled', 'joining', 'in_progress'];

@Injectable()
export class MeetingLifecycleService {
  private readonly logger = new Logger(MeetingLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botLauncher: BotLauncherService,
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
      if (m.assistantStatus === 'scheduled' && m.startTime <= now && m.endTime > now) {
        toJoining.push({ id: m.id, meetLink: m.meetLink });
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

    for (const { id, meetLink } of toJoining) {
      if (meetLink) void this.botLauncher.launch(id, meetLink);
    }

    for (const id of toProcessing) {
      void this.botLauncher.stop(id);
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
