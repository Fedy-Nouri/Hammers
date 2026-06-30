import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { AgentsService } from './agents.service';
import { EntitlementService, type AgentWithEntitlement } from './entitlement.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentResponse } from './dto/agent.response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly entitlement: EntitlementService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List agents with the caller\'s install/allowed flags' })
  findAll(@CurrentUser() user?: ActiveUser): Promise<AgentWithEntitlement[]> {
    return this.entitlement.listForUser(user?.userId);
  }

  @Post(':id/install')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Install an agent for the current user' })
  @ApiResponse({ status: 403, description: 'Plan does not allow this agent' })
  install(@CurrentUser() user: ActiveUser, @Param('id') id: string): Promise<AgentWithEntitlement> {
    return this.entitlement.install(user.userId, id);
  }

  @Delete(':id/install')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Uninstall an agent (history is preserved)' })
  uninstall(@CurrentUser() user: ActiveUser, @Param('id') id: string): Promise<void> {
    return this.entitlement.uninstall(user.userId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agent by id' })
  @ApiParam({ name: 'id', example: 'travel-agent' })
  @ApiResponse({ status: 200, type: AgentResponse })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  findOne(@Param('id') id: string): Promise<AgentResponse> {
    return this.agentsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new agent' })
  @ApiResponse({ status: 201, type: AgentResponse })
  @ApiResponse({ status: 409, description: 'Agent id already taken' })
  create(@Body() dto: CreateAgentDto): Promise<AgentResponse> {
    return this.agentsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update agent metadata or status' })
  @ApiParam({ name: 'id', example: 'travel-agent' })
  @ApiResponse({ status: 200, type: AgentResponse })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  update(@Param('id') id: string, @Body() dto: UpdateAgentDto): Promise<AgentResponse> {
    return this.agentsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an agent' })
  @ApiParam({ name: 'id', example: 'travel-agent' })
  @ApiResponse({ status: 204, description: 'Agent deleted' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  remove(@Param('id') id: string): Promise<void> {
    return this.agentsService.remove(id);
  }
}
