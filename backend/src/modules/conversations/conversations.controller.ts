import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import {
  ConversationResponse,
  PaginatedConversationsResponse,
  PaginatedMessagesResponse,
} from './dto/conversation.response';
import { MessageResponse } from './dto/message.response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';

@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({ status: 201, type: ConversationResponse })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  create(
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateConversationDto,
  ): Promise<ConversationResponse> {
    return this.conversationsService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's conversations" })
  @ApiResponse({ status: 200, type: PaginatedConversationsResponse })
  findAll(
    @CurrentUser() user: ActiveUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedConversationsResponse> {
    return this.conversationsService.findAll(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by id' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: ConversationResponse })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  findOne(
    @CurrentUser() user: ActiveUser,
    @Param('id') id: string,
  ): Promise<ConversationResponse> {
    return this.conversationsService.findOne(id, user.userId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get paginated messages for a conversation' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, type: PaginatedMessagesResponse })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  getMessages(
    @CurrentUser() user: ActiveUser,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedMessagesResponse> {
    return this.conversationsService.getMessages(id, user.userId, query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation and all its messages' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 204, description: 'Conversation deleted' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  remove(@CurrentUser() user: ActiveUser, @Param('id') id: string): Promise<void> {
    return this.conversationsService.remove(id, user.userId);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a message to a conversation' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 201, type: MessageResponse })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  addMessage(
    @CurrentUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ): Promise<MessageResponse> {
    return this.conversationsService.addMessage(id, user.userId, dto);
  }
}
