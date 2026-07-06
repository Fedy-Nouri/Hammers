import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Patch,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle, seconds } from '@nestjs/throttler';
import { BotLauncherService } from './bot-launcher.service';
import { BotCallbackDto } from './dto/bot-callback.dto';

@ApiTags('bot')
@Controller('bot')
export class BotCallbackController {
  constructor(
    private readonly botLauncher: BotLauncherService,
    private readonly config: ConfigService,
  ) {}

  @Patch('callback')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: seconds(60) } })
  @ApiOperation({ summary: 'Internal bot status callback' })
  async callback(
    @Headers('x-bot-secret') secret: string,
    @Body() dto: BotCallbackDto,
  ) {
    const expected = this.config.get<string>('BOT_CALLBACK_SECRET');
    if (!expected || secret !== expected) throw new ForbiddenException();
    await this.botLauncher.handleCallback(dto);
    return { ok: true };
  }
}
