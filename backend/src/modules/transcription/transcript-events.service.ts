import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { TranscriptSegmentDto } from './dto/ingest-transcript.dto';

/**
 * In-memory pub/sub of live transcript segments, keyed by meetingId.
 * The bot ingest endpoint publishes; SSE subscribers consume.
 */
@Injectable()
export class TranscriptEventsService {
  private readonly subjects = new Map<string, Subject<TranscriptSegmentDto>>();

  private getSubject(meetingId: string): Subject<TranscriptSegmentDto> {
    let subject = this.subjects.get(meetingId);
    if (!subject) {
      subject = new Subject<TranscriptSegmentDto>();
      this.subjects.set(meetingId, subject);
    }
    return subject;
  }

  publish(meetingId: string, segment: TranscriptSegmentDto): void {
    this.getSubject(meetingId).next(segment);
  }

  stream(meetingId: string): Observable<TranscriptSegmentDto> {
    return this.getSubject(meetingId).asObservable();
  }
}
