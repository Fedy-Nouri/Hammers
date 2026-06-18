import { chromium, Browser, BrowserContext, Page } from 'playwright';
import axios from 'axios';
import { loginToGoogle } from './google-auth';
import { joinMeet, waitForAdmission } from './meet-joiner';

const ADMISSION_TIMEOUT_MS = 5 * 60 * 1000;

interface Session {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export class BotManager {
  private sessions = new Map<string, Session>();

  private readonly botEmail: string;
  private readonly botPassword: string;
  private readonly backendUrl: string;
  private readonly callbackSecret: string;

  constructor() {
    this.botEmail = process.env.BOT_GOOGLE_EMAIL ?? '';
    this.botPassword = process.env.BOT_GOOGLE_PASSWORD ?? '';
    this.backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
    this.callbackSecret = process.env.BOT_CALLBACK_SECRET ?? '';
  }

  async launch(meetingId: string, meetingUrl: string): Promise<void> {
    if (this.sessions.has(meetingId)) return;

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      permissions: ['camera', 'microphone'],
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    this.sessions.set(meetingId, { browser, context, page });

    // Handle unexpected page close
    page.on('close', () => {
      if (this.sessions.has(meetingId)) {
        this.sessions.delete(meetingId);
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
