import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { CreateConversationDto } from './dto/create-conversation.dto';
import type { CreateMessageDto } from './dto/create-message.dto';
import type { PaginationQueryDto } from './dto/pagination-query.dto';
import type {
  ConversationResponse,
  PaginatedConversationsResponse,
  PaginatedMessagesResponse,
} from './dto/conversation.response';
import type { MessageResponse } from './dto/message.response';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateConversationDto): Promise<ConversationResponse> {
    const agent = await this.prisma.agent.findUnique({ where: { id: dto.agentId } });
    if (!agent) throw new NotFoundException(`Agent "${dto.agentId}" not found`);

    return this.prisma.conversation.create({
      data: { userId, agentId: dto.agentId, title: dto.title ?? null },
      select: { id: true, userId: true, agentId: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async findAll(userId: string, query: PaginationQueryDto): Promise<PaginatedConversationsResponse> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, userId: true, agentId: true, title: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.conversation.count({ where: { userId } }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, userId: string): Promise<ConversationResponse> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: { id: true, userId: true, agentId: true, title: true, createdAt: true, updatedAt: true },
    });
    if (!conversation) throw new NotFoundException(`Conversation "${id}" not found`);
    if (conversation.userId !== userId) throw new ForbiddenException();
    return conversation;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedMessagesResponse> {
    await this.findOne(conversationId, userId);

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        select: { id: true, conversationId: true, role: true, content: true, createdAt: true },
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return { data, total, page, limit };
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);
    await this.prisma.conversation.delete({ where: { id } });
  }

  async addMessage(
    conversationId: string,
    userId: string,
    dto: CreateMessageDto,
  ): Promise<MessageResponse> {
    await this.findOne(conversationId, userId);

    const message = await this.prisma.message.create({
      data: { conversationId, role: dto.role, content: dto.content },
      select: { id: true, conversationId: true, role: true, content: true, createdAt: true },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }
}
