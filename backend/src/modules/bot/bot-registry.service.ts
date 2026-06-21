import { Injectable, Logger } from '@nestjs/common';
import { BotInstance } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** How many times to retry an optimistic claim before giving up. */
const CLAIM_RETRIES = 5;

/**
 * Registry for the meeting-bot fleet (SC-002). Each bot container self-registers
 * and heartbeats; the backend claims a free instance per meeting and releases it
 * when the meeting ends. The backend stores only the container's reachable URL
 * and busy/health state — never Google credentials.
 */
@Injectable()
export class BotRegistryService {
  private readonly logger = new Logger(BotRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Upsert a bot instance by its stable id and mark it online. */
  async register(botId: string, baseUrl: string, label?: string): Promise<void> {
    await this.prisma.botInstance.upsert({
      where: { id: botId },
      create: {
        id: botId,
        baseUrl,
        label: label ?? botId,
        status: 'online',
        lastHeartbeatAt: new Date(),
      },
      update: {
        baseUrl,
        ...(label ? { label } : {}),
        status: 'online',
        lastHeartbeatAt: new Date(),
      },
    });
    this.logger.log(`Bot instance registered: ${botId} @ ${baseUrl}`);
  }

  /** Refresh a bot instance's liveness; no-op if it has not registered yet. */
  async heartbeat(botId: string): Promise<void> {
    await this.prisma.botInstance.updateMany({
      where: { id: botId },
      data: { status: 'online', lastHeartbeatAt: new Date() },
    });
  }

  /**
   * Atomically claim a free online instance for a meeting. Returns the already
   * assigned instance if one exists, or null when none are available. Uses an
   * optimistic update guarded by `currentMeetingId: null` so concurrent claims
   * cannot grab the same instance.
   */
  async claimFreeInstance(meetingId: string): Promise<BotInstance | null> {
    const already = await this.prisma.botInstance.findUnique({
      where: { currentMeetingId: meetingId },
    });
    if (already) return already;

    for (let attempt = 0; attempt < CLAIM_RETRIES; attempt++) {
      const candidate = await this.prisma.botInstance.findFirst({
        where: { status: 'online', currentMeetingId: null },
        orderBy: { lastHeartbeatAt: 'desc' },
      });
      if (!candidate) return null;

      try {
        const res = await this.prisma.botInstance.updateMany({
          where: { id: candidate.id, currentMeetingId: null },
          data: { currentMeetingId: meetingId },
        });
        if (res.count === 1) {
          return this.prisma.botInstance.findUnique({ where: { id: candidate.id } });
        }
        // Lost the race for this candidate; try the next free one.
      } catch {
        // Unique conflict means this meeting was claimed concurrently elsewhere.
        const owner = await this.prisma.botInstance.findUnique({
          where: { currentMeetingId: meetingId },
        });
        if (owner) return owner;
      }
    }
    return null;
  }

  /** Free whichever instance is assigned to this meeting. */
  async release(meetingId: string): Promise<void> {
    await this.prisma.botInstance.updateMany({
      where: { currentMeetingId: meetingId },
      data: { currentMeetingId: null },
    });
  }

  /** Mark instances offline when their heartbeat is older than the threshold. */
  async markStaleOffline(thresholdMs: number): Promise<void> {
    const cutoff = new Date(Date.now() - thresholdMs);
    await this.prisma.botInstance.updateMany({
      where: { status: 'online', lastHeartbeatAt: { lt: cutoff } },
      data: { status: 'offline' },
    });
  }
}
