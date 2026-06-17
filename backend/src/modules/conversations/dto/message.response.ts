import { ApiProperty } from '@nestjs/swagger';
import { MessageRole } from '@prisma/client';

export class MessageResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  conversationId: string;

  @ApiProperty({ enum: MessageRole })
  role: MessageRole;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;
}
