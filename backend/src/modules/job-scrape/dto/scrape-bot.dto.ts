import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ScrapeRegisterDto {
  @ApiProperty()
  @IsString()
  botId: string;

  @ApiProperty()
  @IsString()
  baseUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;
}

export class ScrapeHeartbeatDto {
  @ApiProperty()
  @IsString()
  botId: string;
}

export class ScrapeCallbackDto {
  @ApiProperty()
  @IsString()
  scrapeJobId: string;

  @ApiProperty({ example: 'done', description: 'running | done | failed' })
  @IsString()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  botId?: string;
}
