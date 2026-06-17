import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MeetingSyncService } from './meeting-sync.service';

@Injectable()
export class MeetingSyncScheduler {
  private readonly logger = new Logger(MeetingSyncScheduler.name);

  constructor(
    private readonly meetingSyncService: MeetingSyncService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 */15 * * * *')
  async syncAllUsers(): Promise<void> {
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
  }
}
