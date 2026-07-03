# Hammers — AI Agents Marketplace

> **The App Store for AI Agents.** Hammers is a SaaS platform that gives you access to specialized AI agents that handle real work — attending your meetings, generating content, planning travel, and beyond. Each agent is purpose-built, production-ready, and deeply integrated into the tools you already use.

---

## Agent #1: Meeting Copilot

The first agent on the platform. Meeting Copilot attends your Google Meet calls, transcribes every word with speaker identification, and delivers a complete intelligence package when the meeting ends — a live summary, action items, decisions, risks, an executive report, and a ready-to-send follow-up email.

### End-to-End Pipeline

```
Google Calendar  →  Meeting Sync  →  Bot Launch   →  Audio Capture   →  Transcription  →  AI Analysis  →  Report + Email
   (OAuth 2.0)      (cron 15m)     (Playwright)    (WebRTC patch)      (Deepgram)      (Claude/GPT)
```

**Step by step:**

1. **Calendar Sync** — Connect your Google account via OAuth 2.0. Meetings sync automatically every 15 minutes via a background cron job, storing title, attendees, meet link, and timing.
2. **Bot Launch** — Invite the AI assistant to a meeting from the dashboard. The platform calls the meeting-bot microservice, which spins up a headless Chrome session (Playwright) that joins the Google Meet call with camera and microphone muted.
3. **Audio Capture** — Before Meet loads, an in-page script patches `RTCPeerConnection` to intercept all inbound WebRTC audio tracks. An `AudioWorklet` buffers `Float32` frames, downsamples them to 16 kHz mono, converts to linear16 `Int16`, and posts them to Node.js via an exposed binding.
4. **Live Transcription** — PCM audio chunks stream in real-time to Deepgram's `nova-2` model with speaker diarization, punctuation, and interim results. Final segments are immediately POSTed to the backend.
5. **Incremental AI Analysis** — A background scheduler checks for transcript segments beyond each meeting's stored watermark. New segments are fed to Claude or GPT alongside the rolling summary and existing items. Only newly detected action items, decisions, and risks are returned and persisted — the watermark advances, so each cycle is minimal.
6. **Post-Meeting Report** — When the meeting ends, the full transcript, analysis summary, and all extracted items are assembled into a prompt. The AI produces an executive summary, follow-up recommendations, and a professional recap email — editable in the UI before sending.

### What Meeting Copilot Delivers

| Artifact | Description |
|---|---|
| **Live Summary** | Rolling cumulative summary of the entire meeting, updated each analysis cycle |
| **Action Items** | Tasks with assignees and confidence scores, deduplicated across cycles |
| **Decisions** | Key decisions extracted with normalized deduplication |
| **Risks & Blockers** | Items categorized as `risk`, `blocker`, or `dependency` with transcript timestamps |
| **Executive Report** | Polished 3–5 sentence summary + 3–6 concrete next-step recommendations |
| **Follow-Up Email** | Professional plain-text recap email, editable and copy-ready in the browser |
| **Full Transcript** | Speaker-labeled, millisecond-timestamped segments, collapsible in the report view |

---

## Monorepo Structure

```
Hammers/
├── backend/               NestJS REST API + Prisma ORM
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/              JWT auth, refresh tokens, password reset
│   │   │   ├── users/             Profile, avatar upload, subscription plans
│   │   │   ├── agents/            Agent registry CRUD
│   │   │   ├── ai/                Provider abstraction (Anthropic + OpenAI), SSE streaming
│   │   │   ├── conversations/     Chat conversations + messages with pagination
│   │   │   ├── usage/             Per-request AI token + cost tracking
│   │   │   ├── google-integration/ OAuth 2.0 flow, AES-256-GCM token encryption
│   │   │   ├── meeting-sync/      Google Calendar sync, cron, lifecycle management
│   │   │   ├── bot/               Bot launcher + callback endpoint
│   │   │   ├── transcription/     Ingest endpoint for live transcript segments
│   │   │   ├── analysis/          Incremental AI analysis engine
│   │   │   └── reporting/         Post-meeting report + follow-up email generation
│   │   ├── common/                Guards, decorators, pricing util
│   │   └── infrastructure/        PrismaService
│   └── prisma/schema.prisma
│
├── frontend/              React SPA
│   └── src/
│       ├── pages/
│       │   ├── DashboardPage.tsx
│       │   ├── MarketplacePage.tsx
│       │   ├── ChatPage.tsx
│       │   ├── MeetingsPage.tsx
│       │   ├── MeetingDetailPage.tsx   Transcript + live analysis view
│       │   ├── MeetingMonitorPage.tsx  Bot status dashboard, auto-refreshes 30s
│       │   ├── MeetingReportPage.tsx   Executive report + editable email
│       │   └── ProfilePage.tsx
│       ├── components/    Layout, chat, auth components
│       └── lib/api/       Typed API clients for every backend module
│
├── agents/
│   └── meeting-bot/       Headless browser microservice
│       └── src/
│           ├── index.ts          Express server (POST /start, POST /stop, GET /health)
│           ├── bot-manager.ts    Session lifecycle + Google login
│           ├── meet-joiner.ts    Playwright automation: join, mute, leave, admission poll
│           ├── audio-capture.ts  RTCPeerConnection patch + AudioWorklet → PCM chunks
│           ├── transcriber.ts    Deepgram live client + reconnect + keepalive
│           └── transcript-sender.ts  Batch POST segments to backend
│
└── docker-compose.yml     PostgreSQL + backend + meeting-bot
```

---

## Data Model

```
User ──┬── GoogleIntegration   (OAuth tokens, AES-256-GCM encrypted, sync watermark)
       ├── Meeting ────────────┬── BotJob              (bot lifecycle tracking)
       │                       ├── TranscriptSegment   (speaker-labeled, ms-timestamped)
       │                       ├── MeetingAnalysis     (rolling summary + watermark)
       │                       ├── ActionItem          (task, assignee, confidence, dedupeKey)
       │                       ├── Decision            (text, dedupeKey)
       │                       ├── Risk                (text, category, transcriptRefMs, dedupeKey)
       │                       ├── MeetingReport       (executive, followUps, status)
       │                       └── FollowUpEmail       (subject, body, status)
       └── Conversation ───────── Message[]
```

**Key design decisions:**
- All AI-extracted items carry a `dedupeKey` (normalized lowercase) — incremental cycles never re-insert the same item.
- `MeetingAnalysis.processedUpToMs` is the watermark. Each analysis cycle only feeds segments with `endMs > processedUpToMs`, keeping prompt costs proportional to new content only.
- Google OAuth tokens are encrypted at rest with AES-256-GCM before hitting the database.
- `Meeting.assistantStatus` tracks the full bot lifecycle: `none → scheduled → joining → in_progress → processing → completed / failed`.

---

## Technology Stack

### Backend
| Technology | Version | Role |
|---|---|---|
| NestJS | 11 | Application framework |
| TypeScript | 5 | Language |
| Prisma | 6 | ORM + migrations |
| PostgreSQL | 16 | Primary database |
| Anthropic Claude SDK | 0.104+ | Claude API client |
| OpenAI SDK | 6.x | OpenAI API client |
| @nestjs/jwt + passport-jwt | 11 | JWT authentication |
| @nestjs/schedule | 6 | Cron jobs (calendar sync, analysis scheduler) |
| @nestjs/swagger | 11 | OpenAPI documentation at `/api/docs` |
| bcryptjs | 3 | Password hashing |

### Frontend
| Technology | Version | Role |
|---|---|---|
| React | 19 | UI framework |
| Vite | 8 | Build tool |
| TypeScript | 6 | Language |
| Tailwind CSS | v4 | Styling |
| React Query | 5 | Server state management |
| React Router | 7 | Client-side routing |
| React Hook Form + Zod | 7 / 4 | Form validation |
| Lucide React | latest | Icon library |
| i18next | 26 | Internationalization |

### Meeting Bot
| Technology | Version | Role |
|---|---|---|
| Playwright | 1.52 | Headless Chrome automation |
| Deepgram SDK | 3.x | Live speech-to-text (nova-2) |
| Express | 4 | HTTP server for bot control |
| TypeScript | 5 | Language |

### Infrastructure
| Technology | Role |
|---|---|
| pnpm workspaces | Monorepo package management |
| Docker + Compose | Containerized services |
| PostgreSQL 16 Alpine | Database container |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose
- Google Cloud project with Calendar API enabled and OAuth 2.0 credentials
- A dedicated Google account for the bot (with actual Google Meet access)
- Deepgram API key
- Anthropic and/or OpenAI API keys

### 1. Start the database

```bash
docker-compose up postgres -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — see Environment Variables section below
pnpm install
pnpm prisma:migrate:dev
pnpm start:dev
```

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api/docs`

### 3. Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

- App: `http://localhost:5173`

### 4. Meeting Bot

```bash
cd agents/meeting-bot
cp .env.example .env
# Edit .env — see Environment Variables section below

npm install
npm run login     # One-time: runs interactive Google login to persist the Chrome profile
npm run dev       # Start the bot service
```

- Bot service: `http://localhost:3001`

> The `login` step is required on first run. It opens a real Chrome window for you to log in to the bot's Google account. The session is saved in `.bot-profile/` and reused on all subsequent headless launches.

### Full Docker Deployment

Brings up the whole stack with one command — Postgres, Redis, the backend (which runs
`prisma migrate deploy` on startup), and the nginx-served frontend:

```bash
cp backend/.env.example backend/.env   # then fill it in (JWT, API keys, ENCRYPTION_KEY, …)
docker compose up --build
```

- **App:** http://localhost:8080 (nginx serves the SPA and reverse-proxies `/api` → backend)
- **API:** http://localhost:3000/api · **health:** `GET /api/health` (liveness), `GET /api/health/ready` (DB)

Services: `frontend:8080`, `backend:3000`, `postgres:5432`, `redis:6379`, plus the optional
bot fleet (`meeting-bot`, `job-bot` — need account credentials). The backend reads its full
config from `backend/.env`; DB credentials are overridable via `POSTGRES_USER` /
`POSTGRES_PASSWORD` / `POSTGRES_DB`. For a split-origin deploy (SPA on its own domain), set
`VITE_API_URL` (build arg) and the backend's `CORS_ORIGINS`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret (use a long random string) |
| `JWT_EXPIRES_IN` | Access token TTL (e.g. `7d`) |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `AI_DEFAULT_PROVIDER` | Default AI provider: `anthropic` or `openai` |
| `AI_DEFAULT_MODEL` | Default model (e.g. `claude-sonnet-4-6`) |
| `AI_ANALYSIS_PROVIDER` | Provider used for meeting analysis (can differ from default) |
| `AI_ANALYSIS_MODEL` | Model for meeting analysis |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL (e.g. `http://localhost:3000/api/google/callback`) |
| `ENCRYPTION_KEY` | 32-byte hex string for AES-256-GCM token encryption |
| `BOT_SERVICE_URL` | URL of the meeting-bot service (e.g. `http://localhost:3001`) |
| `BOT_CALLBACK_SECRET` | Shared secret for authenticated bot → backend callbacks |
| `PORT` | Backend port (default `3000`) |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API (split-origin deploys). Empty = same-origin only in prod, allow-all in dev |
| `ENABLE_SWAGGER` | Set `true` to expose `/api/docs` in production (hidden by default) |

### Meeting Bot (`agents/meeting-bot/.env`)

| Variable | Description |
|---|---|
| `BOT_GOOGLE_EMAIL` | Bot Google account email |
| `BOT_GOOGLE_PASSWORD` | Bot Google account password |
| `DEEPGRAM_API_KEY` | Deepgram API key |
| `BACKEND_URL` | Backend API base URL (e.g. `http://localhost:3000`) |
| `BOT_CALLBACK_SECRET` | Must match backend's `BOT_CALLBACK_SECRET` |
| `PORT` | Bot service port (default `3001`) |
| `BOT_HEADLESS` | Set to `false` to run Chrome with a visible window (useful for debugging) |

---

## API Reference

Interactive docs at `http://localhost:3000/api/docs` (served outside production; set
`ENABLE_SWAGGER=true` to expose them in production).

| Group | Endpoints |
|---|---|
| **Health** | `GET /health` (liveness) · `GET /health/ready` (readiness, DB ping) |
| **Auth** | `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `POST /auth/refresh` · `POST /auth/forgot-password` · `POST /auth/reset-password` |
| **Users** | `GET /users/me` · `PATCH /users/me` · `DELETE /users/me` · `POST /users/me/avatar` · `POST /users/me/change-password` |
| **Agents** | `GET /agents` · `POST /agents` · `GET /agents/:id` · `PATCH /agents/:id` · `DELETE /agents/:id` |
| **Chat** | `POST /ai/chat` · `GET /ai/stream` (SSE) |
| **Conversations** | `GET /conversations` · `POST /conversations` · `GET /conversations/:id/messages` · `POST /conversations/:id/messages` · `DELETE /conversations/:id` |
| **Usage** | `GET /usage/summary` · `GET /usage/logs` |
| **Google** | `GET /google/connect` · `GET /google/callback` · `GET /google/status` · `DELETE /google/disconnect` |
| **Meetings** | `GET /meetings` · `POST /meetings/sync` · `GET /meetings/sync/status` |
| **Bot** | `POST /meetings/:id/start-assistant` · `POST /meetings/:id/stop-assistant` |
| **Analysis** | `GET /meetings/:id/analysis` · `PATCH /meetings/:id/analysis/action-items/:itemId` |
| **Reports** | `GET /meetings/:id/report` · `PATCH /meetings/:id/report/email` |

---

## Roadmap

Hammers is architected as an extensible marketplace. Each agent lives in its own module with its own API surface and data model — adding a new agent does not touch shared infrastructure.

**Planned agents:**
- **Content Copilot** — Generates blog posts, social media content, and marketing copy from a brief
- **Travel Planner** — Researches, compares, and books travel based on natural language preferences
- **Research Assistant** — Deep-dives into topics, synthesizes sources, and delivers structured reports
- **Code Reviewer** — Reviews pull requests, flags issues, and suggests improvements with repo context

---

## License

Private — all rights reserved.
