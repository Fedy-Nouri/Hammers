import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn } from 'class-validator';

export class MeetingQueryDto {
  @ApiPropertyOptional({ enum: ['upcoming', 'past', 'all'], default: 'upcoming' })
  @IsOptional()
  @IsIn(['upcoming', 'past', 'all'])
  view?: 'upcoming' | 'past' | 'all' = 'upcoming';
}
