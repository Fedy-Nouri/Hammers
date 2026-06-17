import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageResponse } from './message.response';

export class ConversationResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  agentId: string;

  @ApiPropertyOptional()
  title: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedMessagesResponse {
  @ApiProperty({ type: [MessageResponse] })
  data: MessageResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class PaginatedConversationsResponse {
  @ApiProperty({ type: [ConversationResponse] })
  data: ConversationResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
