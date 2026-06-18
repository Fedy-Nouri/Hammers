import { Injectable, NotFoundException } from '@nestjs/common';
import { TranscriptSegment } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TranscriptEventsService } from './transcript-events.service';
import { IngestTranscriptDto } from './dto/ingest-transcript.dto';

@Injectable()
export class TranscriptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: TranscriptEventsService,
  ) {}

  /**
   * Ingest segments from the bot worker. Only finalized segments are
   * persisted; every segment (final + interim) is published to live
   * SSE subscribers for low-latency display.
   */
  async ingest(dto: IngestTranscriptDto): Promise<void> {
    const finals = dto.segments.filter((s) => s.isFinal);

    if (finals.length > 0) {
      await this.prisma.transcriptSegment.createMany({
        data: finals.map((s) => ({
          meetingId: dto.meetingId,
          speaker: s.speaker ?? null,
          text: s.text,
          startMs: s.startMs,
          endMs: s.endMs,
          confidence: s.confidence ?? null,
        })),
      });
    }

    for (const segment of dto.segments) {
      this.events.publish(dto.meetingId, segment);
    }
  }

  async getStored(userId: string, meetingId: string): Promise<TranscriptSegment[]> {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
      select: { id: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');

    return this.prisma.transcriptSegment.findMany({
      where: { meetingId },
      orderBy: { startMs: 'asc' },
    });
  }

  async assertOwnership(userId: string, meetingId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
      select: { id: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
  }
}
