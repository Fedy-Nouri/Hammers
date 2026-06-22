import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { IngestJobDto } from '../../jobs/dto/ingest-job.dto';

export class BotIngestJobsDto {
  @ApiPropertyOptional({ description: 'The scrape job these results belong to' })
  @IsOptional()
  @IsString()
  scrapeJobId?: string;

  @ApiProperty({ description: 'The user the scraped jobs are for' })
  @IsString()
  userId: string;

  @ApiProperty({ type: [IngestJobDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => IngestJobDto)
  jobs: IngestJobDto[];
}
