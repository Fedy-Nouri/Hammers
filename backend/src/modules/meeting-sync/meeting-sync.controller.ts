import {
  Controller,
  Get,
  Post,
  Delete,
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
} from '@nestjs/swagger';
import { MeetingSyncService } from './meeting-sync.service';
import { MeetingLifecycleService } from './meeting-lifecycle.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';
import { MeetingQueryDto } from './dto/meeting-query.dto';
import { MeetingResponse } from './dto/meeting.response';
import { SyncStatusResponse } from './dto/sync-status.response';

@ApiTags('meetings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class MeetingSyncController {
  constructor(
    private readonly meetingSyncService: MeetingSyncService,
    private readonly lifecycleService: MeetingLifecycleService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List meetings (upcoming by default)' })
  @ApiResponse({ status: 200, type: [MeetingResponse] })
  getMeetings(
    @CurrentUser() user: ActiveUser,
    @Query() query: MeetingQueryDto,
  ) {
    return this.meetingSyncService.getMeetings(user.userId, query.view);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger a calendar sync' })
  @ApiResponse({ status: 200, type: SyncStatusResponse })
  async triggerSync(@CurrentUser() user: ActiveUser): Promise<SyncStatusResponse> {
    await this.meetingSyncService.syncForUser(user.userId);
    return this.meetingSyncService.getSyncStatus(user.userId);
  }

  @Get('sync/status')
  @ApiOperation({ summary: 'Get last sync status' })
  @ApiResponse({ status: 200, type: SyncStatusResponse })
  getSyncStatus(@CurrentUser() user: ActiveUser): Promise<SyncStatusResponse> {
    return this.meetingSyncService.getSyncStatus(user.userId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get meetings being monitored by the assistant' })
  @ApiResponse({ status: 200, type: [MeetingResponse] })
  getDashboard(@CurrentUser() user: ActiveUser): Promise<MeetingResponse[]> {
    return this.lifecycleService.getDashboardMeetings(user.userId) as Promise<MeetingResponse[]>;
  }

  @Post(':id/invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invite the AI assistant to a meeting' })
  @ApiResponse({ status: 200, type: MeetingResponse })
  @ApiResponse({ status: 404, description: 'Meeting not found' })
  @ApiResponse({ status: 400, description: 'Meeting is cancelled or has already ended' })
  @ApiResponse({ status: 409, description: 'Assistant already invited' })
  inviteAssistant(
    @CurrentUser() user: ActiveUser,
    @Param('id') meetingId: string,
  ): Promise<MeetingResponse> {
    return this.meetingSyncService.inviteAssistant(user.userId, meetingId) as Promise<MeetingResponse>;
  }

  @Delete(':id/invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel assistant invitation' })
  @ApiResponse({ status: 200, type: MeetingResponse })
  cancelInvite(
    @CurrentUser() user: ActiveUser,
    @Param('id') meetingId: string,
  ): Promise<MeetingResponse> {
    return this.meetingSyncService.cancelInvite(user.userId, meetingId) as Promise<MeetingResponse>;
  }
}
