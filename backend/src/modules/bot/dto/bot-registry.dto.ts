import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterBotDto {
  @ApiProperty({ description: 'Stable per-container bot identifier (BOT_ID)' })
  @IsString()
  botId: string;

  @ApiProperty({ description: 'Reachable base URL of the bot container' })
  @IsString()
  baseUrl: string;

  @ApiPropertyOptional({ description: 'Human-friendly label (e.g. the bot account email)' })
  @IsOptional()
  @IsString()
  label?: string;
}

export class HeartbeatBotDto {
  @ApiProperty({ description: 'Stable per-container bot identifier (BOT_ID)' })
  @IsString()
  botId: string;
}
