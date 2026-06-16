import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsObject,
  MinLength,
} from 'class-validator';

export class CreateAgentDto {
  @ApiProperty({ example: 'travel-agent' })
  @IsString()
  @MinLength(1)
  id: string;

  @ApiProperty({ example: 'Travel Planner' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ example: 'Plans travel itineraries using AI' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: { model: 'gpt-4o-mini', systemPrompt: 'You are a travel expert.' } })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}
