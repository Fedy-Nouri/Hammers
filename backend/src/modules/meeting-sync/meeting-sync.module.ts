import { Module } from '@nestjs/common';
import { MeetingSyncService } from './meeting-sync.service';
import { MeetingSyncScheduler } from './meeting-sync.scheduler';
import { MeetingSyncController } from './meeting-sync.controller';
import { MeetingLifecycleService } from './meeting-lifecycle.service';
import { MeetingLifecycleScheduler } from './meeting-lifecycle.scheduler';
import { GoogleIntegrationModule } from '../google-integration/google-integration.module';
import { BotModule } from '../bot/bot.module';
import { ReportingModule } from '../reporting/reporting.module';

@Module({
  imports: [GoogleIntegrationModule, BotModule, ReportingModule],
  controllers: [MeetingSyncController],
  providers: [MeetingSyncService, MeetingSyncScheduler, MeetingLifecycleService, MeetingLifecycleScheduler],
})
export class MeetingSyncModule {}
