import axios from 'axios';

export interface OutgoingSegment {
  speaker?: number;
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
  isFinal: boolean;
}

/**
 * Posts transcript segments to the backend ingest endpoint, protected by the
 * shared x-bot-secret. Mirrors the callback pattern in bot-manager.ts.
 */
export async function sendSegments(
  backendUrl: string,
  secret: string,
  meetingId: string,
  segments: OutgoingSegment[],
): Promise<void> {
  if (segments.length === 0) return;
  try {
    await axios.post(
      `${backendUrl}/api/bot/transcript`,
      { meetingId, segments },
      { headers: { 'x-bot-secret': secret }, timeout: 10_000 },
    );
  } catch (err) {
    console.error(`[transcript-sender] Failed for ${meetingId}:`, err);
  }
}
