import { IsString, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BotCallbackDto {
  @ApiProperty()
  @IsString()
  meetingId: string;

  @ApiProperty({ enum: ['waiting', 'joined', 'stopped', 'failed'] })
  @IsIn(['waiting', 'joined', 'stopped', 'failed'])
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error?: string;
}
