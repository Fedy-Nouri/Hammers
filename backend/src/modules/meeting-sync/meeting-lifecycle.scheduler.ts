import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MeetingLifecycleService } from './meeting-lifecycle.service';

@Injectable()
export class MeetingLifecycleScheduler {
  private readonly logger = new Logger(MeetingLifecycleScheduler.name);

  constructor(private readonly lifecycleService: MeetingLifecycleService) {}

  @Cron('0 * * * * *')
  async tick(): Promise<void> {
    try {
      await this.lifecycleService.runTick();
    } catch (err) {
      this.logger.error(`Lifecycle tick failed: ${String(err)}`);
    }
  }
}
