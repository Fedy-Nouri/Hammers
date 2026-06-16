import { ApiProperty } from '@nestjs/swagger';

class UsageDto {
  @ApiProperty()
  promptTokens: number;

  @ApiProperty()
  completionTokens: number;

  @ApiProperty()
  totalTokens: number;
}

export class ChatResponseDto {
  @ApiProperty()
  content: string;

  @ApiProperty({ example: 'openai' })
  provider: string;

  @ApiProperty({ example: 'gpt-4o-mini' })
  model: string;

  @ApiProperty({ type: UsageDto })
  usage: UsageDto;
}
