import { chromium, Browser, BrowserContext, Page } from 'playwright';
import axios from 'axios';
import { loginToGoogle } from './google-auth';
import { joinMeet, waitForAdmission } from './meet-joiner';
import { startCapture, AudioCapture } from './audio-capture';
import { Transcriber } from './transcriber';

const ADMISSION_TIMEOUT_MS = 5 * 60 * 1000;

interface Session {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  capture?: AudioCapture;
  transcriber?: Transcriber;
}

export class BotManager {
  private sessions = new Map<string, Session>();

  private readonly botEmail: string;
  private readonly botPassword: string;
  private readonly backendUrl: string;
  private readonly callbackSecret: string;
  private readonly deepgramApiKey: string;

  constructor() {
    this.botEmail = process.env.BOT_GOOGLE_EMAIL ?? '';
    this.botPassword = process.env.BOT_GOOGLE_PASSWORD ?? '';
    this.backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
    this.callbackSecret = process.env.BOT_CALLBACK_SECRET ?? '';
    this.deepgramApiKey = process.env.DEEPGRAM_API_KEY ?? '';
  }

  async launch(meetingId: string, meetingUrl: string): Promise<void> {
    if (this.sessions.has(meetingId)) return;

    const browser = await chromium.launch({
      headless: true,
      args: ['--autoplay-policy=no-user-gesture-required'],
    });
    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    const session: Session = { browser, context, page };
    this.sessions.set(meetingId, session);

    // Install audio capture before any navigation so the RTCPeerConnection
    // patch is in place before Meet opens its peer connections.
    try {
      session.capture = await startCapture(page);
    } catch (err) {
      console.error(`[BotManager] Audio capture setup failed for ${meetingId}:`, err);
    }

    // Handle unexpected page close
    page.on('close', () => {
      const closed = this.sessions.get(meetingId);
      if (closed) {
        this.sessions.delete(meetingId);
        closed.transcriber?.stop();
        closed.capture?.stop();
        void this.sendCallback(meetingId, 'stopped');
      }
    });

    try {
      await loginToGoogle(page, this.botEmail, this.botPassword);
      const result = await joinMeet(page, meetingUrl);

      if (result === 'waiting') {
        await this.sendCallback(meetingId, 'waiting');
        const admitted = await waitForAdmission(page, ADMISSION_TIMEOUT_MS);
        if (!admitted) {
          await this.stop(meetingId);
          await this.sendCallback(meetingId, 'failed', 'Admission timeout — never let into the meeting');
          return;
        }
      }

      // Now that we are in the meeting, start live transcription.
      if (session.capture && this.deepgramApiKey) {
        session.transcriber = new Transcriber(
          meetingId,
          session.capture,
          this.deepgramApiKey,
          this.backendUrl,
          this.callbackSecret,
        );
        session.transcriber.start();
      } else if (!this.deepgramApiKey) {
        console.warn(`[BotManager] DEEPGRAM_API_KEY not set — transcription disabled for ${meetingId}`);
      }

      await this.sendCallback(meetingId, 'joined');
    } catch (err) {
      await this.stop(meetingId);
      const msg = err instanceof Error ? err.message : String(err);
      await this.sendCallback(meetingId, 'failed', msg);
    }
  }

  async stop(meetingId: string): Promise<void> {
    const session = this.sessions.get(meetingId);
    if (!session) return;
    this.sessions.delete(meetingId);
    session.transcriber?.stop();
    session.capture?.stop();
    try {
      await session.browser.close();
    } catch {
      // Already closed
    }
    await this.sendCallback(meetingId, 'stopped');
  }

  private async sendCallback(
    meetingId: string,
    status: string,
    error?: string,
  ): Promise<void> {
    try {
      await axios.patch(
        `${this.backendUrl}/api/bot/callback`,
        { meetingId, status, error },
        { headers: { 'x-bot-secret': this.callbackSecret }, timeout: 10_000 },
      );
    } catch (err) {
      console.error(`[BotManager] Callback failed for ${meetingId}:`, err);
    }
  }

  activeSessions(): string[] {
    return [...this.sessions.keys()];
  }
}
