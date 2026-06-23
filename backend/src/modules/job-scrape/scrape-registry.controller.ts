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
import { JobBotRegistryService } from './job-bot-registry.service';
import { ScrapeRegisterDto, ScrapeHeartbeatDto } from './dto/scrape-bot.dto';

@ApiTags('bot')
@Controller('bot/scrape-instances')
export class ScrapeRegistryController {
  constructor(
    private readonly registry: JobBotRegistryService,
    private readonly config: ConfigService,
  ) {}

  private assertSecret(secret: string): void {
    const expected = this.config.get<string>('BOT_CALLBACK_SECRET');
    if (!expected || secret !== expected) throw new ForbiddenException();
  }

  @Post('register')
  @HttpCode(200)
  @ApiOperation({ summary: 'Internal: register a job-bot scraper instance' })
  async register(
    @Headers('x-bot-secret') secret: string,
    @Body() dto: ScrapeRegisterDto,
  ) {
    this.assertSecret(secret);
    await this.registry.register(dto.botId, dto.baseUrl, dto.label);
    return { ok: true };
  }

  @Post('heartbeat')
  @HttpCode(200)
  @ApiOperation({ summary: 'Internal: job-bot scraper heartbeat' })
  async heartbeat(
    @Headers('x-bot-secret') secret: string,
    @Body() dto: ScrapeHeartbeatDto,
  ) {
    this.assertSecret(secret);
    await this.registry.heartbeat(dto.botId);
    return { ok: true };
  }
}
