import express, { Request, Response } from 'express';
import { BotManager } from './bot-manager';
import { startRegistrar } from './registrar';

const app = express();
app.use(express.json());

const manager = new BotManager();
const PORT = parseInt(process.env.PORT ?? '3002', 10);

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    busy: manager.isBusy(),
    activeSessions: manager.activeSessions(),
  });
});

app.post('/start', (req: Request, res: Response) => {
  const { scrapeJobId, userId, preferences } = req.body as {
    scrapeJobId?: string;
    userId?: string;
    preferences?: Record<string, unknown>;
  };
  if (!scrapeJobId || !userId) {
    res.status(400).json({ error: 'scrapeJobId and userId are required' });
    return;
  }
  // Idempotent: this container is already running the requested scrape.
  if (manager.hasSession(scrapeJobId)) {
    res.status(202).json({ ok: true, scrapeJobId, alreadyRunning: true });
    return;
  }
  // One LinkedIn account per container — refuse a second scrape so the backend reassigns.
  if (manager.isBusy()) {
    res.status(409).json({ ok: false, busy: true, scrapeJobId });
    return;
  }
  void manager.run({ scrapeJobId, userId, preferences: preferences ?? {} });
  res.status(202).json({ ok: true, scrapeJobId });
});

app.post('/stop', (req: Request, res: Response) => {
  const { scrapeJobId } = req.body as { scrapeJobId?: string };
  if (!scrapeJobId) {
    res.status(400).json({ error: 'scrapeJobId is required' });
    return;
  }
  void manager.stop(scrapeJobId);
  res.json({ ok: true, scrapeJobId });
});

app.listen(PORT, () => {
  console.log(`[job-bot] Listening on port ${PORT}`);

  const botId = process.env.BOT_ID;
  const selfUrl = process.env.SELF_URL;
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
  const secret = process.env.BOT_CALLBACK_SECRET ?? '';
  const label = process.env.LINKEDIN_EMAIL;

  if (botId && selfUrl) {
    startRegistrar({ backendUrl, secret, botId, selfUrl, label });
  } else {
    console.warn('[job-bot] BOT_ID or SELF_URL not set — skipping fleet registration');
  }
});
