import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import axios from 'axios';
import { loginToGoogle } from './google-auth';
import { joinMeet, leaveMeet, waitForAdmission } from './meet-joiner';
import { startCapture, AudioCapture } from './audio-capture';
import { Transcriber } from './transcriber';

const ADMISSION_TIMEOUT_MS = 5 * 60 * 1000;

// One Google account per container → at most one meeting at a time.
const MAX_CONCURRENT = 1;

const USER_DATA_DIR =
  process.env.BOT_USER_DATA_DIR ?? path.join(process.cwd(), '.bot-profile');

interface Session {
  context: BrowserContext;
  page: Page;
  capture?: AudioCapture;
  transcriber?: Transcriber;
}

export class BotManager {
  private sessions = new Map<string, Session>();

  private readonly botId: string;
  private readonly botEmail: string;
  private readonly botPassword: string;
  private readonly backendUrl: string;
  private readonly callbackSecret: string;
  private readonly deepgramApiKey: string;

  private readonly headless: boolean;

  constructor() {
    this.botId = process.env.BOT_ID ?? '';
    this.botEmail = process.env.BOT_GOOGLE_EMAIL ?? '';
    this.botPassword = process.env.BOT_GOOGLE_PASSWORD ?? '';
    this.backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
    this.callbackSecret = process.env.BOT_CALLBACK_SECRET ?? '';
    this.deepgramApiKey = process.env.DEEPGRAM_API_KEY ?? '';
    this.headless = process.env.BOT_HEADLESS !== 'false';
    console.log(`[BotManager] headless=${this.headless}, backendUrl=${this.backendUrl}, secret=${this.callbackSecret ? '***' : '(empty!)'}`);
  }

  async launch(meetingId: string, meetingUrl: string): Promise<void> {
    if (this.sessions.has(meetingId)) return;

    console.log(`[BotManager] Launching browser for meeting ${meetingId} (headless=${this.headless})`);
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: this.headless,
      channel: 'chrome',
      locale: 'en-US',
      args: [
        '--autoplay-policy=no-user-gesture-required',
        '--disable-blink-features=AutomationControlled',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--lang=en-US',
      ],
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    const session: Session = { context, page };
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
      console.log(`[BotManager] Login done for ${meetingId}, joining Meet…`);

      const result = await joinMeet(page, meetingUrl);
      console.log(`[BotManager] joinMeet result: ${result}`);

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
        console.log(`[BotManager] Transcription started for ${meetingId}`);
      } else if (!this.deepgramApiKey) {
        console.warn(`[BotManager] DEEPGRAM_API_KEY not set — transcription disabled for ${meetingId}`);
      }

      await this.sendCallback(meetingId, 'joined');
      console.log(`[BotManager] Bot fully joined meeting ${meetingId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[BotManager] Join failed for ${meetingId}: ${msg}`);
      await page.screenshot({ path: `./debug-${meetingId}.png` }).catch(() => {});
      console.log(`[BotManager] Screenshot saved: ./debug-${meetingId}.png`);
      await this.stop(meetingId);
      await this.sendCallback(meetingId, 'failed', msg);
    }
  }

  async stop(meetingId: string): Promise<void> {
    const session = this.sessions.get(meetingId);
    if (!session) return;
    this.sessions.delete(meetingId);
    session.transcriber?.stop();
    session.capture?.stop();
    await leaveMeet(session.page).catch(() => {});
    try {
      await session.context.close();
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
        { meetingId, status, error, botId: this.botId },
        { headers: { 'x-bot-secret': this.callbackSecret }, timeout: 10_000 },
      );
    } catch (err) {
      console.error(`[BotManager] Callback failed for ${meetingId}:`, err);
    }
  }

  activeSessions(): string[] {
    return [...this.sessions.keys()];
  }

  hasSession(meetingId: string): boolean {
    return this.sessions.has(meetingId);
  }

  isBusy(): boolean {
    return this.sessions.size >= MAX_CONCURRENT;
  }
}
