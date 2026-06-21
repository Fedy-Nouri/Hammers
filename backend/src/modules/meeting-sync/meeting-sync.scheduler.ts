import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MeetingSyncService } from './meeting-sync.service';
import { RedisLockService } from '../../infrastructure/redis/redis-lock.service';

const LOCK_KEY = 'lock:meeting-sync';
const LOCK_TTL_MS = 10 * 60_000; // shorter than the 15-min interval

@Injectable()
export class MeetingSyncScheduler {
  private readonly logger = new Logger(MeetingSyncScheduler.name);

  constructor(
    private readonly meetingSyncService: MeetingSyncService,
    private readonly prisma: PrismaService,
    private readonly lock: RedisLockService,
  ) {}

  @Cron('0 */15 * * * *')
  async syncAllUsers(): Promise<void> {
    await this.lock.withLock(LOCK_KEY, LOCK_TTL_MS, async () => {
      const integrations = await this.prisma.googleIntegration.findMany({
        select: { userId: true },
      });

      for (const { userId } of integrations) {
        try {
          await this.meetingSyncService.syncForUser(userId);
        } catch (err) {
          this.meetingSyncService.logSyncError(userId, err);
        }
      }

      if (integrations.length > 0) {
        this.logger.log(`Synced calendar for ${integrations.length} user(s)`);
      }
    });
  }
}
