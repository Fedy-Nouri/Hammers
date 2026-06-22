import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard, seconds } from '@nestjs/throttler';
import { JobScrapeService } from './job-scrape.service';
import { BotIngestJobsDto } from './dto/bot-ingest-jobs.dto';

@ApiTags('bot')
@Controller('bot/jobs')
export class BotJobsController {
  constructor(
    private readonly scrape: JobScrapeService,
    private readonly config: ConfigService,
  ) {}

  @Post('ingest')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: seconds(60) } })
  @ApiOperation({ summary: 'Internal: ingest scraped job listings from a job-bot' })
  async ingest(
    @Headers('x-bot-secret') secret: string,
    @Body() dto: BotIngestJobsDto,
  ) {
    const expected = this.config.get<string>('BOT_CALLBACK_SECRET');
    if (!expected || secret !== expected) throw new ForbiddenException();
    return this.scrape.ingestScraped(dto);
  }
}
