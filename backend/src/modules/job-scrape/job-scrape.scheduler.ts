import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisLockService } from '../../infrastructure/redis/redis-lock.service';
import { JobBotRegistryService } from './job-bot-registry.service';
import { JobScrapeLauncherService } from './job-scrape-launcher.service';

const LOCK_KEY = 'lock:job-scrape-tick';
const LOCK_TTL_MS = 13 * 60 * 1000; // shorter than the 15-min cron interval
const INSTANCE_STALE_MS = 90_000;

@Injectable()
export class JobScrapeScheduler {
  private readonly logger = new Logger(JobScrapeScheduler.name);

  constructor(
    private readonly registry: JobBotRegistryService,
    private readonly launcher: JobScrapeLauncherService,
    private readonly lock: RedisLockService,
  ) {}

  @Cron('0 */15 * * * *')
  async tick(): Promise<void> {
    try {
      await this.lock.withLock(LOCK_KEY, LOCK_TTL_MS, async () => {
        await this.registry.markStaleOffline(INSTANCE_STALE_MS);
        await this.launcher.enqueueDueUsers();
        await this.launcher.dispatchQueued();
      });
    } catch (err) {
      this.logger.error(`Job-scrape tick failed: ${String(err)}`);
    }
  }
}
