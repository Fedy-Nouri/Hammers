import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BotCallbackDto } from './dto/bot-callback.dto';

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 30_000;

@Injectable()
export class BotLauncherService {
  private readonly logger = new Logger(BotLauncherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  private get botUrl(): string {
    return this.config.getOrThrow<string>('BOT_SERVICE_URL');
  }

  async launch(meetingId: string, meetingUrl: string): Promise<void> {
    const job = await this.prisma.botJob.upsert({
      where: { meetingId },
      create: { meetingId, status: 'launching', attempts: 1 },
      update: { status: 'launching', attempts: { increment: 1 }, lastError: null },
    });

    try {
      await firstValueFrom(
        this.http.post(`${this.botUrl}/start`, { meetingId, meetingUrl }, { timeout: 10_000 }),
      );
      this.logger.log(`Bot launch dispatched for meeting ${meetingId}`);
    } catch (err) {
      const attempts = job.attempts;
      this.logger.warn(`Bot launch failed for ${meetingId} (attempt ${attempts}): ${String(err)}`);

      if (attempts >= MAX_ATTEMPTS) {
        await this.markFailed(meetingId, `Launch failed after ${MAX_ATTEMPTS} attempts`);
        return;
      }

      const delay = RETRY_BASE_MS * attempts;
      setTimeout(() => void this.launch(meetingId, meetingUrl), delay);
    }
  }

  async stop(meetingId: string): Promise<void> {
    const job = await this.prisma.botJob.findUnique({ where: { meetingId } });
    if (!job || job.status === 'stopped' || job.status === 'stopping') return;

    await this.prisma.botJob.update({
      where: { meetingId },
      data: { status: 'stopping' },
    });

    try {
      await firstValueFrom(
        this.http.post(`${this.botUrl}/stop`, { meetingId }, { timeout: 10_000 }),
      );
    } catch (err) {
      this.logger.warn(`Bot stop request failed for ${meetingId}: ${String(err)}`);
    }
  }

  async handleCallback(dto: BotCallbackDto): Promise<void> {
    const { meetingId, status, error } = dto;

    const updateData: Record<string, unknown> = { status };
    if (status === 'joined') updateData.startedAt = new Date();
    if (status === 'stopped') updateData.stoppedAt = new Date();
    if (error) updateData.lastError = error;

    const job = await this.prisma.botJob.update({
      where: { meetingId },
      data: updateData,
    });

    if (status === 'failed') {
      if (job.attempts < MAX_ATTEMPTS) {
        const meeting = await this.prisma.meeting.findUnique({
          where: { id: meetingId },
          select: { meetLink: true },
        });
        if (meeting?.meetLink) {
          const delay = RETRY_BASE_MS * job.attempts;
          setTimeout(() => void this.launch(meetingId, meeting.meetLink!), delay);
        }
      } else {
        await this.markFailed(meetingId, error ?? 'Bot reported failure');
      }
    }
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
