import express, { Request, Response } from 'express';
import { BotManager } from './bot-manager';
import { startRegistrar } from './registrar';

const app = express();
app.use(express.json());

const manager = new BotManager();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    busy: manager.isBusy(),
    activeSessions: manager.activeSessions().length,
  });
});

app.post('/start', (req: Request, res: Response) => {
  const { meetingId, meetingUrl } = req.body as { meetingId?: string; meetingUrl?: string };
  if (!meetingId || !meetingUrl) {
    res.status(400).json({ error: 'meetingId and meetingUrl are required' });
    return;
  }
  // Idempotent: this container is already running the requested meeting.
  if (manager.hasSession(meetingId)) {
    res.status(202).json({ ok: true, meetingId, alreadyRunning: true });
    return;
  }
  // One account per container — refuse a second meeting so the backend reassigns.
  if (manager.isBusy()) {
    res.status(409).json({ ok: false, busy: true, meetingId });
    return;
  }
  void manager.launch(meetingId, meetingUrl);
  res.status(202).json({ ok: true, meetingId });
});

app.post('/stop', (req: Request, res: Response) => {
  const { meetingId } = req.body as { meetingId?: string };
  if (!meetingId) {
    res.status(400).json({ error: 'meetingId is required' });
    return;
  }
  void manager.stop(meetingId);
  res.json({ ok: true, meetingId });
});

app.listen(PORT, () => {
  console.log(`[meeting-bot] Listening on port ${PORT}`);

  const botId = process.env.BOT_ID;
  const selfUrl = process.env.SELF_URL;
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
  const secret = process.env.BOT_CALLBACK_SECRET ?? '';
  const label = process.env.BOT_GOOGLE_EMAIL;

  if (botId && selfUrl) {
    startRegistrar({ backendUrl, secret, botId, selfUrl, label });
  } else {
    console.warn('[meeting-bot] BOT_ID or SELF_URL not set — skipping fleet registration');
  }
});
