import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FollowUpEmail } from '@prisma/client';
import { MeetingReportResponse, ReportingService } from './reporting.service';
import { UpdateEmailDto } from './dto/update-email.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';

@ApiTags('meetings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get(':id/report')
  @ApiOperation({ summary: 'Get final meeting report (executive summary, transcript, follow-ups, email)' })
  getReport(
    @CurrentUser() user: ActiveUser,
    @Param('id') id: string,
  ): Promise<MeetingReportResponse> {
    return this.reporting.getReport(user.userId, id);
  }

  @Patch(':id/email')
  @ApiOperation({ summary: 'Edit the generated follow-up email (subject, body)' })
  updateEmail(
    @CurrentUser() user: ActiveUser,
    @Param('id') id: string,
    @Body() dto: UpdateEmailDto,
  ): Promise<FollowUpEmail> {
    return this.reporting.updateEmail(user.userId, id, dto);
  }

  @Post(':id/email/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send the follow-up email to the meeting owner' })
  sendEmail(
    @CurrentUser() user: ActiveUser,
    @Param('id') id: string,
  ): Promise<FollowUpEmail> {
    return this.reporting.sendFollowUp(user.userId, id);
  }
}
