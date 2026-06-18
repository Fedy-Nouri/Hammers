import { Module } from '@nestjs/common';
import { TranscriptService } from './transcript.service';
import { TranscriptEventsService } from './transcript-events.service';
import { TranscriptController } from './transcript.controller';
import { TranscriptIngestController } from './transcript-ingest.controller';

@Module({
  providers: [TranscriptService, TranscriptEventsService],
  controllers: [TranscriptController, TranscriptIngestController],
})
export class TranscriptionModule {}
