import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { MessageRole } from '@prisma/client';

export class CreateMessageDto {
  @ApiProperty({ enum: MessageRole, example: MessageRole.user })
  @IsEnum(MessageRole)
  role: MessageRole;

  @ApiProperty({ example: 'Plan a 7-day itinerary for Tokyo.' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
