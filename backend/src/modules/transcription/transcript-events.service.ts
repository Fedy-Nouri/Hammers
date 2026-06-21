import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants';
import { TranscriptSegmentDto } from './dto/ingest-transcript.dto';

const CHANNEL_PREFIX = 'meeting:';
const CHANNEL_SUFFIX = ':transcript';
const CHANNEL_PATTERN = `${CHANNEL_PREFIX}*${CHANNEL_SUFFIX}`;

/**
 * Pub/sub of live transcript segments, keyed by meetingId (SC-007). With Redis
 * configured, segments are published to a per-meeting channel and fanned out to
 * SSE subscribers on every backend replica; without Redis it degrades to an
 * in-process Subject (single-instance dev). The public API (publish/stream) is
 * unchanged so the controllers need no edits.
 */
@Injectable()
export class TranscriptEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TranscriptEventsService.name);
  private readonly subjects = new Map<string, Subject<TranscriptSegmentDto>>();
  private readonly refCounts = new Map<string, number>();
  private subscriber: Redis | null = null;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  async onModuleInit(): Promise<void> {
    if (!this.redis) return;
    // ioredis requires a dedicated connection for subscriber mode.
    this.subscriber = this.redis.duplicate();
    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      const subject = this.subjects.get(this.meetingIdFromChannel(channel));
      if (!subject) return; // no local SSE subscriber for this meeting
      try {
        subject.next(JSON.parse(message) as TranscriptSegmentDto);
      } catch {
        // ignore malformed payloads
      }
    });
    await this.subscriber.psubscribe(CHANNEL_PATTERN);
    this.logger.log(`Subscribed to Redis pattern ${CHANNEL_PATTERN}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit().catch(() => undefined);
      this.subscriber = null;
    }
  }

  publish(meetingId: string, segment: TranscriptSegmentDto): void {
    if (this.redis) {
      // Fan out via Redis; local subscribers receive it back through pmessage.
      void this.redis.publish(this.channel(meetingId), JSON.stringify(segment));
      return;
    }
    this.subjects.get(meetingId)?.next(segment);
  }

  stream(meetingId: string): Observable<TranscriptSegmentDto> {
    return new Observable<TranscriptSegmentDto>((subscriber) => {
      const subject = this.getSubject(meetingId);
      this.refCounts.set(meetingId, (this.refCounts.get(meetingId) ?? 0) + 1);
      const inner = subject.subscribe(subscriber);
      return () => {
        inner.unsubscribe();
        const remaining = (this.refCounts.get(meetingId) ?? 1) - 1;
        if (remaining <= 0) {
          this.refCounts.delete(meetingId);
          this.subjects.delete(meetingId);
        } else {
          this.refCounts.set(meetingId, remaining);
        }
      };
    });
  }

  private getSubject(meetingId: string): Subject<TranscriptSegmentDto> {
    let subject = this.subjects.get(meetingId);
    if (!subject) {
      subject = new Subject<TranscriptSegmentDto>();
      this.subjects.set(meetingId, subject);
    }
    return subject;
  }

  private channel(meetingId: string): string {
    return `${CHANNEL_PREFIX}${meetingId}${CHANNEL_SUFFIX}`;
  }

  private meetingIdFromChannel(channel: string): string {
    return channel.slice(CHANNEL_PREFIX.length, channel.length - CHANNEL_SUFFIX.length);
  }
}
