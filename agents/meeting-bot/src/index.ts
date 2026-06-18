import express, { Request, Response } from 'express';
import { BotManager } from './bot-manager';

const app = express();
app.use(express.json());

const manager = new BotManager();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, activeSessions: manager.activeSessions().length });
});

app.post('/start', (req: Request, res: Response) => {
  const { meetingId, meetingUrl } = req.body as { meetingId?: string; meetingUrl?: string };
  if (!meetingId || !meetingUrl) {
    res.status(400).json({ error: 'meetingId and meetingUrl are required' });
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
});
