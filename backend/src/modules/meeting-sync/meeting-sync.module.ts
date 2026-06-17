import { Module } from '@nestjs/common';
import { MeetingSyncService } from './meeting-sync.service';
import { MeetingSyncScheduler } from './meeting-sync.scheduler';
import { MeetingSyncController } from './meeting-sync.controller';
import { GoogleIntegrationModule } from '../google-integration/google-integration.module';

@Module({
  imports: [GoogleIntegrationModule],
  controllers: [MeetingSyncController],
  providers: [MeetingSyncService, MeetingSyncScheduler],
})
export class MeetingSyncModule {}
