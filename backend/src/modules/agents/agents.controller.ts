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
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentResponse } from './dto/agent.response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all agents' })
  @ApiResponse({ status: 200, type: [AgentResponse] })
  findAll(): Promise<AgentResponse[]> {
    return this.agentsService.findAll();
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
