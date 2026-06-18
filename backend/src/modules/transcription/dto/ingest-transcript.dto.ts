import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TranscriptSegmentDto {
  @ApiPropertyOptional({ description: 'Deepgram diarization speaker index' })
  @IsOptional()
  @IsInt()
  speaker?: number;

  @ApiProperty()
  @IsString()
  text: string;

  @ApiProperty({ description: 'Start offset in ms, relative to capture start' })
  @IsInt()
  startMs: number;

  @ApiProperty({ description: 'End offset in ms, relative to capture start' })
  @IsInt()
  endMs: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  confidence?: number;

  @ApiProperty({ description: 'Whether this is a finalized (non-interim) segment' })
  @IsBoolean()
  isFinal: boolean;
}

export class IngestTranscriptDto {
  @ApiProperty()
  @IsString()
  meetingId: string;

  @ApiProperty({ type: [TranscriptSegmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptSegmentDto)
  segments: TranscriptSegmentDto[];
}
