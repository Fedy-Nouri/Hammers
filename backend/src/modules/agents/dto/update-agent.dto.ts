import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsIn, IsOptional, IsObject, MinLength } from 'class-validator';

export class UpdateAgentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: ['free', 'pro', 'enterprise'] })
  @IsOptional()
  @IsIn(['free', 'pro', 'enterprise'])
  minPlan?: 'free' | 'pro' | 'enterprise';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}
