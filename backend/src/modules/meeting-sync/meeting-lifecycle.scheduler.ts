import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MeetingLifecycleService } from './meeting-lifecycle.service';
import { RedisLockService } from '../../infrastructure/redis/redis-lock.service';

const LOCK_KEY = 'lock:lifecycle-tick';
const LOCK_TTL_MS = 55_000; // shorter than the 60s cron interval

@Injectable()
export class MeetingLifecycleScheduler {
  private readonly logger = new Logger(MeetingLifecycleScheduler.name);

  constructor(
    private readonly lifecycleService: MeetingLifecycleService,
    private readonly lock: RedisLockService,
  ) {}

  @Cron('0 * * * * *')
  async tick(): Promise<void> {
    try {
      await this.lock.withLock(LOCK_KEY, LOCK_TTL_MS, () =>
        this.lifecycleService.runTick(),
      );
    } catch (err) {
      this.logger.error(`Lifecycle tick failed: ${String(err)}`);
    }
  }
}
