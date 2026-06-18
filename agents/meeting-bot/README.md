# Meeting Bot — Agent Service

A standalone Node.js + Playwright service that joins Google Meet calls on behalf of the user. It is part of the **Meeting Copilot** feature group (MC-005 / MC-006).

---

## How it fits into the platform

```
┌─────────────────────────────────────────────────────────────┐
│  NestJS Backend (port 3000)                                 │
│                                                             │
│  MeetingLifecycleService (cron — every minute)              │
│    │                                                        │
│    │ scheduled → joining transition detected                │
│    ▼                                                        │
│  BotLauncherService ──── POST /start ──────────────────────►│
│       ▲                                                     │
│       │ PATCH /api/bot/callback (status updates)           │
└───────┼─────────────────────────────────────────────────────┘
        │
┌───────┼─────────────────────────────────────────────────────┐
│  Meeting Bot (port 3001)  agents/meeting-bot/               │
│                                                             │
│  Express server                                             │
│    ├── POST /start  → BotManager.launch()                   │
│    ├── POST /stop   → BotManager.stop()                     │
│    └── GET  /health → { ok: true }                          │
│                                                             │
│  BotManager                                                 │
│    ├── loginToGoogle()   (google-auth.ts)                   │
│    └── joinMeet()        (meet-joiner.ts)                   │
└─────────────────────────────────────────────────────────────┘
```

The backend is the **orchestrator** — it owns scheduling, retry logic, and state persistence (`BotJob` table). The bot service is a **dumb worker** — it only knows how to open a browser and join a meeting. All business logic stays in NestJS.

---

## Source files

```
src/
  index.ts        Express HTTP server — entry point
  bot-manager.ts  Session store + async launch/stop orchestration
  google-auth.ts  Playwright Google sign-in flow
  meet-joiner.ts  Google Meet navigation + join automation
```

### `index.ts`
Starts an Express server on `PORT` (default 3001) with three routes:

| Method | Path      | Body                          | What it does                                      |
|--------|-----------|-------------------------------|---------------------------------------------------|
| GET    | /health   | —                             | Returns `{ ok: true, activeSessions: N }`         |
| POST   | /start    | `{ meetingId, meetingUrl }`   | Begins bot session (responds 202, async execution)|
| POST   | /stop     | `{ meetingId }`               | Closes the browser session for that meeting       |

`/start` returns **202 Accepted immediately** and runs the browser work in the background. Status is reported back to the backend via HTTP callback, not the response.

---

### `bot-manager.ts`
Maintains a `Map<meetingId, { browser, context, page }>` of active Playwright sessions.

**`launch(meetingId, meetingUrl)` flow:**
1. Launches a Chromium browser (headless)
2. Creates a browser context with `camera` + `microphone` permissions pre-granted (prevents browser permission popups)
3. Attaches a `page.on('close')` listener — if the page dies unexpectedly, it sends a `stopped` callback automatically
4. Calls `loginToGoogle()` → `joinMeet()`
5. If the bot lands in a **waiting room**, sends a `waiting` callback then polls for admission for up to 5 minutes. If never admitted → `failed`
6. On success → sends `joined` callback
7. On any error → closes the browser, sends `failed` callback with the error message

**`stop(meetingId)` flow:**
1. Looks up the session in the map
2. Removes it from the map (prevents the `close` listener from double-firing)
3. Closes the browser
4. Sends a `stopped` callback

---

### `google-auth.ts` — `loginToGoogle(page, email, password)`
Standard Playwright-driven Google login:

```
1. Navigate to accounts.google.com/signin
2. Fill email field → click "Next"
3. Wait for password field to appear
4. Fill password → click "Next"
5. Wait for navigation to complete
6. Verify we left accounts.google.com — if still there, login failed
```

The bot account must **not** have 2FA enabled. Use a dedicated Google account created for this purpose.

---

### `meet-joiner.ts` — `joinMeet(page, meetUrl)`
Handles the pre-join and join steps:

```
1. Navigate to the Meet URL
2. Mute camera and microphone on the pre-join screen
   (the bot is a listener, not a participant — no video/audio)
3. Wait for either:
     a. A "Join now" button  → click it → return 'joined'
     b. A waiting room element → click "Ask to join" → return 'waiting'
```

**`waitForAdmission(page, timeoutMs)`** — called after a `waiting` result. Polls every 5 seconds to check whether the waiting room element has disappeared (meaning the host admitted the bot). Returns `true` if admitted, `false` on timeout.

Google Meet's DOM selectors change over time. The selectors in `meet-joiner.ts` use `aria-label` patterns and `jsname` attributes which are more stable than class names, but may still need updating if Google rolls out a new Meet UI.

---

## Callback protocol

After every status change, the bot POSTs to `${BACKEND_URL}/api/bot/callback`:

```json
{
  "meetingId": "uuid",
  "status": "waiting | joined | stopped | failed",
  "error": "optional error message"
}
```

The request carries an `x-bot-secret` header. The backend validates this against the `BOT_CALLBACK_SECRET` env var and returns 403 if it doesn't match. This protects the internal callback route from being called by anything outside the private network.

---

## Retry logic (owned by the backend, not this service)

The bot service itself makes no retry decisions. If a launch fails, it reports `failed` and the backend's `BotLauncherService` decides whether to retry:

- Attempt 1 fails → retry after 30s
- Attempt 2 fails → retry after 60s
- Attempt 3 fails → mark `Meeting.assistantStatus = 'failed'`, give up

---

## Environment variables

| Variable             | Description                                              |
|----------------------|----------------------------------------------------------|
| `PORT`               | HTTP port (default: 3001)                                |
| `BOT_GOOGLE_EMAIL`   | Email of the dedicated Google bot account                |
| `BOT_GOOGLE_PASSWORD`| Password of the bot account (no 2FA)                    |
| `BACKEND_URL`        | Base URL of the NestJS backend (e.g. `http://localhost:3000`) |
| `BOT_CALLBACK_SECRET`| Shared secret for the `/api/bot/callback` route          |

Copy `.env.example` to `.env` and fill in the values before running.

---

## Running locally

```bash
# Install dependencies
npm install

# Install Chromium browser
npx playwright install chromium

# Start in dev mode (ts-node, no build needed)
npm run dev

# Or build first, then run
npm run build
npm start
```

---

## Docker

The `Dockerfile` is based on the official Microsoft Playwright image (`mcr.microsoft.com/playwright:v1.52.0-jammy`) which ships with Chromium and all its system dependencies pre-installed. No `apt-get` or manual browser setup needed.

```bash
# Build the image
docker build -t meeting-bot .

# Run it
docker run -p 3001:3001 \
  -e BOT_GOOGLE_EMAIL=bot@yourcompany.com \
  -e BOT_GOOGLE_PASSWORD=secret \
  -e BACKEND_URL=http://host.docker.internal:3000 \
  -e BOT_CALLBACK_SECRET=your-secret \
  meeting-bot
```

In Docker Compose the service is named `meeting-bot` and the backend references it at `http://meeting-bot:3001` via the internal Docker network.

---

## State machine (BotJob)

The `BotJob` table in the backend tracks each bot session:

```
pending
  └─► launching   (POST /start sent)
        ├─► waiting     (in waiting room, polling for admission)
        │     └─► joined    (admitted by host)
        └─► joined     (joined directly, no waiting room)
              └─► stopping  (POST /stop sent by backend at meeting end)
                    └─► stopped

Any state ──► failed  (error or 3 retries exhausted)
```
