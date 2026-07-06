import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle, seconds } from '@nestjs/throttler';
import { TranscriptService } from './transcript.service';
import { IngestTranscriptDto } from './dto/ingest-transcript.dto';

@ApiTags('bot')
@Controller('bot')
export class TranscriptIngestController {
  constructor(
    private readonly transcripts: TranscriptService,
    private readonly config: ConfigService,
  ) {}

  @Post('transcript')
  @HttpCode(200)
  @Throttle({ default: { limit: 3000, ttl: seconds(60) } })
  @ApiOperation({ summary: 'Internal bot transcript ingest' })
  async ingest(
    @Headers('x-bot-secret') secret: string,
    @Body() dto: IngestTranscriptDto,
  ) {
    const expected = this.config.get<string>('BOT_CALLBACK_SECRET');
    if (!expected || secret !== expected) throw new ForbiddenException();
    await this.transcripts.ingest(dto);
    return { ok: true };
  }
}
