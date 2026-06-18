import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { TranscriptSegment } from '@prisma/client';
import { TranscriptService } from './transcript.service';
import { TranscriptEventsService } from './transcript-events.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { ActiveUser } from '../auth/strategies/jwt.strategy';

@ApiTags('meetings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class TranscriptController {
  constructor(
    private readonly transcripts: TranscriptService,
    private readonly events: TranscriptEventsService,
  ) {}

  @Get(':id/transcript')
  @ApiOperation({ summary: 'Get stored transcript segments for a meeting' })
  getTranscript(
    @CurrentUser() user: ActiveUser,
    @Param('id') id: string,
  ): Promise<TranscriptSegment[]> {
    return this.transcripts.getStored(user.userId, id);
  }

  @Get(':id/transcript/stream')
  @ApiOperation({ summary: 'Stream live transcript segments via SSE' })
  async streamTranscript(
    @CurrentUser() user: ActiveUser,
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.transcripts.assertOwnership(user.userId, id);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const subscription = this.events.stream(id).subscribe((segment) => {
      res.write(`data: ${JSON.stringify(segment)}\n\n`);
    });

    req.on('close', () => {
      subscription.unsubscribe();
      res.end();
    });
  }
}
