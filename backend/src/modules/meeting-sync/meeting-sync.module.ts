import { Module } from '@nestjs/common';
import { MeetingSyncService } from './meeting-sync.service';
import { MeetingSyncScheduler } from './meeting-sync.scheduler';
import { MeetingSyncController } from './meeting-sync.controller';
import { MeetingLifecycleService } from './meeting-lifecycle.service';
import { MeetingLifecycleScheduler } from './meeting-lifecycle.scheduler';
import { GoogleIntegrationModule } from '../google-integration/google-integration.module';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [GoogleIntegrationModule, BotModule],
  controllers: [MeetingSyncController],
  providers: [MeetingSyncService, MeetingSyncScheduler, MeetingLifecycleService, MeetingLifecycleScheduler],
})
export class MeetingSyncModule {}
