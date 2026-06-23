import { Injectable, Logger } from '@nestjs/common';
import { JobBotInstance } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const CLAIM_RETRIES = 5;

/**
 * Registry for the job-bot scraper fleet (JA-007). Mirrors the meeting fleet's
 * BotRegistryService but is dedicated to scrape work and keyed on
 * `currentScrapeJobId`, so the production meeting fleet is untouched.
 */
@Injectable()
export class JobBotRegistryService {
  private readonly logger = new Logger(JobBotRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async register(botId: string, baseUrl: string, label?: string): Promise<void> {
    await this.prisma.jobBotInstance.upsert({
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
    this.logger.log(`Job-bot registered: ${botId} @ ${baseUrl}`);
  }

  async heartbeat(botId: string): Promise<void> {
    await this.prisma.jobBotInstance.updateMany({
      where: { id: botId },
      data: { status: 'online', lastHeartbeatAt: new Date() },
    });
  }

  /** Atomically claim a free online instance for a scrape job (optimistic). */
  async claimFreeInstance(scrapeJobId: string): Promise<JobBotInstance | null> {
    const already = await this.prisma.jobBotInstance.findUnique({
      where: { currentScrapeJobId: scrapeJobId },
    });
    if (already) return already;

    for (let attempt = 0; attempt < CLAIM_RETRIES; attempt++) {
      const candidate = await this.prisma.jobBotInstance.findFirst({
        where: { status: 'online', currentScrapeJobId: null },
        orderBy: { lastHeartbeatAt: 'desc' },
      });
      if (!candidate) return null;

      const res = await this.prisma.jobBotInstance.updateMany({
        where: { id: candidate.id, currentScrapeJobId: null },
        data: { currentScrapeJobId: scrapeJobId },
      });
      if (res.count === 1) {
        return this.prisma.jobBotInstance.findUnique({ where: { id: candidate.id } });
      }
      // Lost the race for this candidate; try the next free one.
    }
    return null;
  }

  async release(scrapeJobId: string): Promise<void> {
    await this.prisma.jobBotInstance.updateMany({
      where: { currentScrapeJobId: scrapeJobId },
      data: { currentScrapeJobId: null },
    });
  }

  async markStaleOffline(thresholdMs: number): Promise<void> {
    const cutoff = new Date(Date.now() - thresholdMs);
    await this.prisma.jobBotInstance.updateMany({
      where: { status: 'online', lastHeartbeatAt: { lt: cutoff } },
      data: { status: 'offline' },
    });
  }
}
