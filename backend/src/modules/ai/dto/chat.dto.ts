import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @ApiProperty({ enum: ['system', 'user', 'assistant'] })
  @IsEnum(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  content: string;
}

export class ChatDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @ApiPropertyOptional({ example: 'gpt-4o-mini' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ enum: ['openai', 'anthropic'] })
  @IsOptional()
  @IsIn(['openai', 'anthropic'])
  provider?: 'openai' | 'anthropic';

  @ApiPropertyOptional({ example: 'travel-agent' })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversationId?: string;
}
