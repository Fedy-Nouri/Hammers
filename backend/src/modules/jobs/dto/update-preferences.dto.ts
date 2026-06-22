import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const REMOTE_PREFS = ['any', 'remote', 'hybrid', 'onsite'] as const;
export type RemotePref = (typeof REMOTE_PREFS)[number];

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ example: ['Senior Backend Engineer', 'Platform Engineer'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  desiredTitles?: string[];

  @ApiPropertyOptional({ example: ['Berlin', 'Remote (EU)'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @ApiPropertyOptional({ enum: REMOTE_PREFS, example: 'remote' })
  @IsOptional()
  @IsIn(REMOTE_PREFS)
  remotePref?: RemotePref;

  @ApiPropertyOptional({ example: 80000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ example: ['NestJS', 'TypeScript', 'Kubernetes'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];
}
