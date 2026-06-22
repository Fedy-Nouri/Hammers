import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { JobProfile, JobScrapeJob } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { JobBotRegistryService } from './job-bot-registry.service';

const MAX_ATTEMPTS = 3;
const SCRAPE_INTERVAL_MS = 12 * 60 * 60 * 1000; // don't re-scrape a user within 12h
const QUEUE_BATCH = 20;

export interface ScrapeCallback {
  scrapeJobId: string;
  status: string; // running | done | failed
  error?: string;
  botId?: string;
}

@Injectable()
export class JobScrapeLauncherService {
  private readonly logger = new Logger(JobScrapeLauncherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly registry: JobBotRegistryService,
  ) {}

  /** Create a queued scrape job for a user. */
  enqueue(userId: string, requested: 'manual' | 'scheduled'): Promise<JobScrapeJob> {
    return this.prisma.jobScrapeJob.create({
      data: { userId, requested, status: 'queued' },
    });
  }

  /** Claim a free instance and dispatch the scrape; leaves it queued if none free. */
  async launch(scrapeJobId: string): Promise<void> {
    const job = await this.prisma.jobScrapeJob.findUnique({ where: { id: scrapeJobId } });
    if (!job || job.status === 'running' || job.status === 'done') return;

    const instance = await this.registry.claimFreeInstance(scrapeJobId);
    if (!instance) {
      this.logger.warn(`No free job-bot for scrape ${scrapeJobId}; left queued`);
      return;
    }

    const updated = await this.prisma.jobScrapeJob.update({
      where: { id: scrapeJobId },
      data: {
        status: 'running',
        jobBotInstanceId: instance.id,
        startedAt: new Date(),
        attempts: { increment: 1 },
        lastError: null,
      },
    });

    const profile = await this.prisma.jobProfile.findUnique({ where: { userId: job.userId } });

    try {
      await firstValueFrom(
        this.http.post(
          `${instance.baseUrl}/start`,
          { scrapeJobId, userId: job.userId, preferences: this.toPreferences(profile) },
          { timeout: 10_000 },
        ),
      );
      this.logger.log(`Scrape dispatched ${scrapeJobId} → ${instance.id}`);
    } catch (err) {
      this.logger.warn(`Scrape dispatch failed for ${scrapeJobId}: ${String(err)}`);
      await this.registry.release(scrapeJobId);
      await this.prisma.jobScrapeJob.update({
        where: { id: scrapeJobId },
        data: {
          status: updated.attempts >= MAX_ATTEMPTS ? 'failed' : 'queued',
          lastError: String(err),
        },
      });
    }
  }

  /** Try to dispatch any queued scrape jobs (called by the scheduler tick). */
  async dispatchQueued(): Promise<void> {
    const queued = await this.prisma.jobScrapeJob.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      take: QUEUE_BATCH,
    });
    for (const job of queued) await this.launch(job.id);
  }

  /** Enqueue scheduled scrapes for users with preferences not scraped recently. */
  async enqueueDueUsers(): Promise<void> {
    const profiles = await this.prisma.jobProfile.findMany({
      where: { OR: [{ desiredTitles: { isEmpty: false } }, { keywords: { isEmpty: false } }] },
      select: { userId: true },
    });
    const cutoff = new Date(Date.now() - SCRAPE_INTERVAL_MS);
    for (const { userId } of profiles) {
      const recent = await this.prisma.jobScrapeJob.findFirst({
        where: { userId, createdAt: { gte: cutoff } },
        select: { id: true },
      });
      if (recent) continue;
      await this.enqueue(userId, 'scheduled');
    }
  }

  async handleCallback(dto: ScrapeCallback): Promise<void> {
    const job = await this.prisma.jobScrapeJob.findUnique({ where: { id: dto.scrapeJobId } });
    if (!job) {
      this.logger.warn(`Callback for unknown scrape ${dto.scrapeJobId}`);
      return;
    }
    if (dto.botId && job.jobBotInstanceId && dto.botId !== job.jobBotInstanceId) {
      this.logger.warn(`Ignoring scrape callback for ${dto.scrapeJobId} from ${dto.botId}`);
      return;
    }

    const terminal = dto.status === 'done' || dto.status === 'failed';
    await this.prisma.jobScrapeJob.update({
      where: { id: dto.scrapeJobId },
      data: {
        status: dto.status,
        ...(terminal && { finishedAt: new Date() }),
        ...(dto.error && { lastError: dto.error }),
      },
    });

    if (terminal) await this.registry.release(dto.scrapeJobId);
  }

  private toPreferences(profile: JobProfile | null) {
    if (!profile) return {};
    return {
      desiredTitles: profile.desiredTitles,
      locations: profile.locations,
      remotePref: profile.remotePref,
      keywords: profile.keywords,
      salaryMin: profile.salaryMin,
    };
  }
}
