import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { ListenLiveClient } from '@deepgram/sdk';
import type { AudioCapture } from './audio-capture';
import { sendSegments, OutgoingSegment } from './transcript-sender';

interface DgWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}
interface DgAlternative {
  transcript: string;
  confidence: number;
  words?: DgWord[];
}
interface DgChannel {
  alternatives: DgAlternative[];
}
interface DgTranscript {
  is_final?: boolean;
  channel?: DgChannel;
  start?: number;
  duration?: number;
}

const MAX_BUFFER_CHUNKS = 500; // bounded PCM backlog during a reconnect gap

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
}

const KEEPALIVE_MS = 8000;
const MAX_RECONNECT_DELAY_MS = 10_000;

function toSegment(data: DgTranscript): OutgoingSegment | null {
  const alt = data.channel?.alternatives?.[0];
  if (!alt || !alt.transcript || alt.transcript.trim() === '') return null;

  const words = alt.words ?? [];
  let speaker: number | undefined;
  if (words.length > 0) {
    const counts = new Map<number, number>();
    for (const w of words) {
      if (typeof w.speaker === 'number') {
        counts.set(w.speaker, (counts.get(w.speaker) ?? 0) + 1);
      }
    }
    let best = -1;
    let bestCount = 0;
    for (const [sp, c] of counts) {
      if (c > bestCount) {
        best = sp;
        bestCount = c;
      }
    }
    speaker = best >= 0 ? best : undefined;
  }

  const start = words.length > 0 ? words[0].start : data.start ?? 0;
  const end =
    words.length > 0
      ? words[words.length - 1].end
      : (data.start ?? 0) + (data.duration ?? 0);

  return {
    speaker,
    text: alt.transcript,
    startMs: Math.round(start * 1000),
    endMs: Math.round(end * 1000),
    confidence: alt.confidence,
    isFinal: data.is_final === true,
  };
}

/**
 * Streams captured PCM to Deepgram's live API and forwards resulting transcript
 * segments to the backend. Owns reconnection: on socket close/error it buffers
 * audio (bounded) and reconnects with exponential backoff.
 */
export class Transcriber {
  private connection: ListenLiveClient | null = null;
  private buffer: Buffer[] = [];
  private connected = false;
  private stopped = false;
  private reconnectAttempt = 0;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private readonly onChunk = (chunk: Buffer): void => this.handleChunk(chunk);

  constructor(
    private readonly meetingId: string,
    private readonly capture: AudioCapture,
    private readonly apiKey: string,
    private readonly backendUrl: string,
    private readonly secret: string,
  ) {}

  start(): void {
    this.capture.events.on('chunk', this.onChunk);
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.capture.events.off('chunk', this.onChunk);
    this.stopKeepAlive();
    if (this.connection) {
      try {
        this.connection.requestClose();
      } catch {
        // already closing
      }
      this.connection = null;
    }
    this.buffer = [];
  }

  private connect(): void {
    if (this.stopped) return;

    const deepgram = createClient(this.apiKey);
    const connection = deepgram.listen.live({
      model: 'nova-2',
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
      interim_results: true,
      punctuate: true,
      diarize: true,
    });
    this.connection = connection;

    connection.on(LiveTranscriptionEvents.Open, () => {
      this.connected = true;
      this.reconnectAttempt = 0;
      this.flushBuffer();
      this.startKeepAlive();
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data: unknown) => {
      const segment = toSegment(data as DgTranscript);
      if (segment) {
        void sendSegments(this.backendUrl, this.secret, this.meetingId, [segment]);
      }
    });

    connection.on(LiveTranscriptionEvents.Error, (err: unknown) => {
      console.error(`[transcriber] ${this.meetingId} error:`, err);
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      this.connected = false;
      this.stopKeepAlive();
      if (!this.stopped) this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      MAX_RECONNECT_DELAY_MS,
      1000 * 2 ** this.reconnectAttempt,
    );
    this.reconnectAttempt += 1;
    setTimeout(() => this.connect(), delay);
  }

  private handleChunk(chunk: Buffer): void {
    if (this.connected && this.connection) {
      this.connection.send(toArrayBuffer(chunk));
    } else {
      this.buffer.push(chunk);
      if (this.buffer.length > MAX_BUFFER_CHUNKS) this.buffer.shift();
    }
  }

  private flushBuffer(): void {
    if (!this.connection) return;
    for (const chunk of this.buffer) this.connection.send(toArrayBuffer(chunk));
    this.buffer = [];
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      const conn = this.connection as { keepAlive?: () => void } | null;
      if (conn && typeof conn.keepAlive === 'function') conn.keepAlive();
    }, KEEPALIVE_MS);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
}
