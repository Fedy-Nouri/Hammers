# Contributing to Hammers

Thanks for working on Hammers. This guide covers local setup and the conventions the
codebase follows.

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`corepack enable` will provide it)
- **Docker** (for local Postgres + Redis, and to build the images)

## Repository layout

This is a pnpm workspace (`pnpm-workspace.yaml`):

- `backend/` — NestJS + Prisma + PostgreSQL REST API (Swagger at `/api/docs` in dev)
- `frontend/` — React + Vite + Tailwind SPA
- `agents/` — standalone bot microservices (`meeting-bot`, `job-bot`), built via `npm ci`
- `docker-compose.yml` — Postgres, Redis, backend, frontend, and the bot fleet

## Getting started

```bash
pnpm install

# Bring up Postgres + Redis (see docker-compose.yml)
docker compose up -d postgres redis

# Configure the backend
cp backend/.env.example backend/.env   # then fill in the required values
```

Required env vars are validated at boot (`backend/src/config/env.validation.ts`); the app
aborts with a clear message if any are missing. Integration keys (Stripe, Resend, Google,
Azure, …) are optional — those services degrade gracefully when unset.

### Running the app

```bash
pnpm dev            # backend + frontend together
pnpm dev:backend    # API only  (http://localhost:3000, docs at /api/docs)
pnpm dev:frontend   # SPA only  (http://localhost:5173)
```

## Quality gates

Everything below runs in CI on every pull request — run them locally before pushing:

```bash
pnpm --filter backend build          # nest build (type-check)
pnpm --filter backend test           # unit tests
pnpm --filter backend test:e2e       # HTTP e2e (no external infra needed)

pnpm --filter frontend build         # tsc -b + vite build
pnpm --filter frontend lint          # eslint (blocking)
pnpm --filter frontend test          # vitest
```

Coverage: `pnpm --filter backend test:cov` and `pnpm --filter frontend test:coverage`.

## Branch & commit conventions

- Branch off `main` per change: `feat/…`, `fix/…`, `test/…`, `chore/…`, `ci/…`, `docs/…`.
- **Conventional Commits** for messages, e.g. `feat(billing): …`, `fix(deploy): …`,
  `test(auth): …`. Keep each PR focused on one logical change.
- Open a pull request into `main`; CI must be green before merge.
- Do not commit secrets or generated output (`dist/`, `coverage/`, `.env`).

## Database changes

Schema lives in `backend/prisma/schema.prisma`. Create migrations with the Prisma CLI and
commit the generated migration folder. Deployed containers apply migrations automatically on
boot (`docker-entrypoint.sh` runs `prisma migrate deploy`).

## Reporting security issues

Please follow [SECURITY.md](./SECURITY.md) — do not open a public issue for vulnerabilities.
