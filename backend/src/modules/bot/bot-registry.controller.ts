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
import { BotRegistryService } from './bot-registry.service';
import { RegisterBotDto, HeartbeatBotDto } from './dto/bot-registry.dto';

@ApiTags('bot')
@Controller('bot/instances')
export class BotRegistryController {
  constructor(
    private readonly registry: BotRegistryService,
    private readonly config: ConfigService,
  ) {}

  private assertSecret(secret: string): void {
    const expected = this.config.get<string>('BOT_CALLBACK_SECRET');
    if (!expected || secret !== expected) throw new ForbiddenException();
  }

  @Post('register')
  @HttpCode(200)
  @ApiOperation({ summary: 'Internal: register a bot instance' })
  async register(
    @Headers('x-bot-secret') secret: string,
    @Body() dto: RegisterBotDto,
  ) {
    this.assertSecret(secret);
    await this.registry.register(dto.botId, dto.baseUrl, dto.label);
    return { ok: true };
  }

  @Post('heartbeat')
  @HttpCode(200)
  @ApiOperation({ summary: 'Internal: bot instance heartbeat' })
  async heartbeat(
    @Headers('x-bot-secret') secret: string,
    @Body() dto: HeartbeatBotDto,
  ) {
    this.assertSecret(secret);
    await this.registry.heartbeat(dto.botId);
    return { ok: true };
  }
}
