import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { JOB_STATUSES } from '../jobs.constants';
import type { JobStatus } from '../jobs.constants';

export class ListApplicationsQuery {
  @ApiPropertyOptional({ enum: JOB_STATUSES })
  @IsOptional()
  @IsIn(JOB_STATUSES)
  status?: JobStatus;
}
