import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class IngestJobDto {
  @ApiPropertyOptional({ example: 'https://www.linkedin.com/jobs/view/123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;

  @ApiProperty({ example: 'Senior Backend Engineer' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  company: string;

  @ApiPropertyOptional({ example: 'Berlin, Germany (Hybrid)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @ApiProperty({ example: 'We are looking for a backend engineer with NestJS experience...' })
  @IsString()
  @MinLength(20)
  description: string;
}
