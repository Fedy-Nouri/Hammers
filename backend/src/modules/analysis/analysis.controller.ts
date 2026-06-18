import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActionItem } from '@prisma/client';
import { AnalysisService, MeetingAnalysisResponse } from './analysis.service';
import { UpdateActionItemDto } from './dto/update-action-item.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';

@ApiTags('meetings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Get(':id/analysis')
  @ApiOperation({ summary: 'Get AI analysis (summary, action items, decisions, risks) for a meeting' })
  getAnalysis(
    @CurrentUser() user: ActiveUser,
    @Param('id') id: string,
  ): Promise<MeetingAnalysisResponse> {
    return this.analysis.getAnalysis(user.userId, id);
  }

  @Patch(':id/action-items/:itemId')
  @ApiOperation({ summary: 'Edit a detected action item (task, assignee, status)' })
  updateActionItem(
    @CurrentUser() user: ActiveUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateActionItemDto,
  ): Promise<ActionItem> {
    return this.analysis.updateActionItem(user.userId, id, itemId, dto);
  }
}
