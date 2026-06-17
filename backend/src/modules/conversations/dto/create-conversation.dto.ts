import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ example: 'travel-agent' })
  @IsString()
  @IsNotEmpty()
  agentId: string;

  @ApiPropertyOptional({ example: 'Trip to Japan 2026' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}
