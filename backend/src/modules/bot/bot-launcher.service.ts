import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BotRegistryService } from './bot-registry.service';
import { BotCallbackDto } from './dto/bot-callback.dto';

const MAX_ATTEMPTS = 3;

@Injectable()
export class BotLauncherService {
  private readonly logger = new Logger(BotLauncherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly registry: BotRegistryService,
  ) {}

  /**
   * Claim a free bot instance and dispatch the meeting to it. When no instance
   * is free the meeting is left 'queued' for the lifecycle tick to retry; on a
   * dispatch error the instance is released and retry is driven by the lifecycle
   * tick (no in-process timers).
   */
  async launch(meetingId: string, meetingUrl: string): Promise<void> {
    const instance = await this.registry.claimFreeInstance(meetingId);
    if (!instance) {
      await this.prisma.botJob.upsert({
        where: { meetingId },
        create: { meetingId, status: 'queued' },
        update: { status: 'queued' },
      });
      this.logger.warn(`No free bot instance for meeting ${meetingId}; queued for retry`);
      return;
    }

    const job = await this.prisma.botJob.upsert({
      where: { meetingId },
      create: { meetingId, botInstanceId: instance.id, status: 'launching', attempts: 1 },
      update: {
        botInstanceId: instance.id,
        status: 'launching',
        attempts: { increment: 1 },
        lastError: null,
      },
    });

    try {
      await firstValueFrom(
        this.http.post(
          `${instance.baseUrl}/start`,
          { meetingId, meetingUrl },
          { timeout: 10_000 },
        ),
      );
      this.logger.log(`Bot launch dispatched for meeting ${meetingId} → ${instance.id}`);
    } catch (err) {
      this.logger.warn(
        `Bot launch failed for ${meetingId} on ${instance.id} (attempt ${job.attempts}): ${String(err)}`,
      );
      // Free the instance so the next lifecycle tick can re-claim one.
      await this.registry.release(meetingId);
      if (job.attempts >= MAX_ATTEMPTS) {
        await this.markFailed(meetingId, `Launch failed after ${MAX_ATTEMPTS} attempts`);
      }
    }
  }

  /** Route a stop request to the instance that owns the meeting. */
  async stop(meetingId: string): Promise<void> {
    const job = await this.prisma.botJob.findUnique({ where: { meetingId } });
    if (!job || job.status === 'stopped' || job.status === 'stopping') return;

    await this.prisma.botJob.update({
      where: { meetingId },
      data: { status: 'stopping' },
    });

    const instance = job.botInstanceId
      ? await this.prisma.botInstance.findUnique({ where: { id: job.botInstanceId } })
      : null;

    if (!instance) {
      this.logger.warn(`No bot instance recorded for meeting ${meetingId}; nothing to stop`);
      await this.registry.release(meetingId);
      return;
    }

    try {
      await firstValueFrom(
        this.http.post(`${instance.baseUrl}/stop`, { meetingId }, { timeout: 10_000 }),
      );
    } catch (err) {
      this.logger.warn(`Bot stop request failed for ${meetingId} on ${instance.id}: ${String(err)}`);
    }
    // The instance is released on the 'stopped' callback; the reaper is the backstop.
  }

  async handleCallback(dto: BotCallbackDto): Promise<void> {
    const { meetingId, status, error, botId } = dto;

    const job = await this.prisma.botJob.findUnique({ where: { meetingId } });
    if (!job) {
      this.logger.warn(`Callback for unknown meeting ${meetingId}`);
      return;
    }

    // Ignore callbacks from an instance other than the one we assigned.
    if (botId && job.botInstanceId && botId !== job.botInstanceId) {
      this.logger.warn(
        `Ignoring callback for ${meetingId} from ${botId}; assigned to ${job.botInstanceId}`,
      );
      return;
    }

    const updateData: Record<string, unknown> = { status };
    if (status === 'joined') updateData.startedAt = new Date();
    if (status === 'stopped') updateData.stoppedAt = new Date();
    if (error) updateData.lastError = error;

    await this.prisma.botJob.update({ where: { meetingId }, data: updateData });

    // Free the instance on terminal states.
    if (status === 'stopped' || status === 'failed') {
      await this.registry.release(meetingId);
    }

    if (status === 'failed' && job.attempts >= MAX_ATTEMPTS) {
      await this.markFailed(meetingId, error ?? 'Bot reported failure');
    }
    // Retry for failed jobs below MAX_ATTEMPTS is driven by the lifecycle tick.
  }

  private async markFailed(meetingId: string, reason: string): Promise<void> {
    await Promise.all([
      this.prisma.botJob.update({
        where: { meetingId },
        data: { status: 'failed', lastError: reason },
      }),
      this.prisma.meeting.update({
        where: { id: meetingId },
        data: { assistantStatus: 'failed' },
      }),
    ]);
    this.logger.error(`Bot permanently failed for meeting ${meetingId}: ${reason}`);
  }
}
