import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard, seconds } from '@nestjs/throttler';
import { JobScrapeLauncherService } from './job-scrape-launcher.service';
import { ScrapeCallbackDto } from './dto/scrape-bot.dto';

@ApiTags('bot')
@Controller('bot/scrape')
export class ScrapeCallbackController {
  constructor(
    private readonly launcher: JobScrapeLauncherService,
    private readonly config: ConfigService,
  ) {}

  @Patch('callback')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: seconds(60) } })
  @ApiOperation({ summary: 'Internal: job-bot scrape status callback' })
  async callback(
    @Headers('x-bot-secret') secret: string,
    @Body() dto: ScrapeCallbackDto,
  ) {
    const expected = this.config.get<string>('BOT_CALLBACK_SECRET');
    if (!expected || secret !== expected) throw new ForbiddenException();
    await this.launcher.handleCallback(dto);
    return { ok: true };
  }
}
