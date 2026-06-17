import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
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

  @Post('chat/stream')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stream AI response via SSE (text/event-stream)' })
  @ApiResponse({ status: 200, description: 'SSE stream of content chunks' })
  async chatStream(
    @CurrentUser() user: ActiveUser,
    @Body() dto: ChatDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const chunk of this.aiService.chatStream(dto.messages, {
        model: dto.model,
        temperature: dto.temperature,
        providerName: dto.provider,
        userId: user.userId,
        agentId: dto.agentId,
        conversationId: dto.conversationId,
      })) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
    } catch {
      res.write(`data: ${JSON.stringify({ error: 'AI provider error' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }
}
