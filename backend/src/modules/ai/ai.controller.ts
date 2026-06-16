import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send messages to the configured AI provider' })
  @ApiResponse({ status: 200, type: ChatResponseDto })
  chat(
    @CurrentUser() user: ActiveUser,
    @Body() dto: ChatDto,
  ): Promise<ChatResponseDto> {
    return this.aiService.chat(dto.messages, {
      model: dto.model,
      temperature: dto.temperature,
      providerName: dto.provider,
      agentId: dto.agentId,
      userId: user.userId,
    });
  }
}
