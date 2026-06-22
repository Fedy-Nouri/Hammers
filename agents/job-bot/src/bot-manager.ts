import { chromium, BrowserContext } from 'playwright';
import path from 'path';
import axios from 'axios';
import { loginToLinkedIn } from './linkedin-auth';
import { scrapeJobs, ScrapePreferences, ScrapedJob } from './scraper';

// One LinkedIn account per container → at most one scrape at a time.
const MAX_CONCURRENT = 1;

const USER_DATA_DIR =
  process.env.BOT_USER_DATA_DIR ?? path.join(process.cwd(), '.bot-profile');
const MAX_JOBS = parseInt(process.env.MAX_JOBS_PER_SCRAPE ?? '10', 10);

export interface ScrapeRequest {
  scrapeJobId: string;
  userId: string;
  preferences: ScrapePreferences;
}

export class BotManager {
  private sessions = new Map<string, BrowserContext>();

  private readonly botId: string;
  private readonly email: string;
  private readonly password: string;
  private readonly backendUrl: string;
  private readonly callbackSecret: string;
  private readonly proxyUrl: string;
  private readonly headless: boolean;

  constructor() {
    this.botId = process.env.BOT_ID ?? '';
    this.email = process.env.LINKEDIN_EMAIL ?? '';
    this.password = process.env.LINKEDIN_PASSWORD ?? '';
    this.backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
    this.callbackSecret = process.env.BOT_CALLBACK_SECRET ?? '';
    this.proxyUrl = process.env.PROXY_URL ?? '';
    this.headless = process.env.BOT_HEADLESS !== 'false';
  }

  isBusy(): boolean {
    return this.sessions.size >= MAX_CONCURRENT;
  }

  hasSession(scrapeJobId: string): boolean {
    return this.sessions.has(scrapeJobId);
  }

  activeSessions(): string[] {
    return [...this.sessions.keys()];
  }

  /** Run a scrape end-to-end: login → scrape → ingest results → callback. */
  async run(req: ScrapeRequest): Promise<void> {
    const { scrapeJobId, userId, preferences } = req;
    if (this.sessions.has(scrapeJobId)) return;

    let context: BrowserContext | undefined;
    try {
      context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: this.headless,
        channel: 'chrome',
        locale: 'en-US',
        ...(this.proxyUrl ? { proxy: { server: this.proxyUrl } } : {}),
        args: ['--disable-blink-features=AutomationControlled', '--lang=en-US'],
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      });
      this.sessions.set(scrapeJobId, context);

      const page = await context.newPage();
      await loginToLinkedIn(page, this.email, this.password);

      const jobs = await scrapeJobs(page, preferences, MAX_JOBS);
      console.log(`[job-bot] Scraped ${jobs.length} job(s) for scrape ${scrapeJobId}`);

      await this.sendIngest(scrapeJobId, userId, jobs);
      await this.callback(scrapeJobId, 'done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[job-bot] Scrape ${scrapeJobId} failed: ${msg}`);
      await this.callback(scrapeJobId, 'failed', msg);
    } finally {
      this.sessions.delete(scrapeJobId);
      if (context) await context.close().catch(() => undefined);
    }
  }

  /** Abort a running scrape by closing its browser context. */
  async stop(scrapeJobId: string): Promise<void> {
    const context = this.sessions.get(scrapeJobId);
    if (!context) return;
    this.sessions.delete(scrapeJobId);
    await context.close().catch(() => undefined);
  }

  private async sendIngest(
    scrapeJobId: string,
    userId: string,
    jobs: ScrapedJob[],
  ): Promise<void> {
    if (jobs.length === 0) return;
    await axios.post(
      `${this.backendUrl}/api/bot/jobs/ingest`,
      { scrapeJobId, userId, jobs },
      { headers: { 'x-bot-secret': this.callbackSecret }, timeout: 30_000 },
    );
  }

  private async callback(
    scrapeJobId: string,
    status: 'done' | 'failed',
    error?: string,
  ): Promise<void> {
    try {
      await axios.patch(
        `${this.backendUrl}/api/bot/scrape/callback`,
        { scrapeJobId, status, error, botId: this.botId },
        { headers: { 'x-bot-secret': this.callbackSecret }, timeout: 10_000 },
      );
    } catch (err) {
      console.error(`[job-bot] Callback failed for ${scrapeJobId}:`, err);
    }
  }
}
