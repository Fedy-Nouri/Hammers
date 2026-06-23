import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JOB_STATUSES } from '../jobs.constants';
import type { JobStatus } from '../jobs.constants';

export class UpdateApplicationDto {
  @ApiPropertyOptional({ enum: JOB_STATUSES })
  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: JobStatus;

  @ApiPropertyOptional({ example: 'Recruiter call scheduled for Tuesday.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
