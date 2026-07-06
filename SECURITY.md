# Security Policy

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report suspected vulnerabilities privately through one of:

- **GitHub Private Vulnerability Reporting** — open a report from the repository's
  **Security → Report a vulnerability** tab (preferred). This keeps the discussion
  private until a fix is released.
- **Email** — `fadinouri305@gmail.com` with the subject line `SECURITY: <short summary>`.

Please include enough detail to reproduce:

- affected component (backend module, frontend page, a bot agent, infra) and version/commit,
- a description of the impact (what an attacker can do),
- reproduction steps or a proof of concept,
- any relevant logs — **redact secrets, tokens, and personal data** before sending.

## What to expect

- **Acknowledgement** within 3 business days.
- An initial assessment and severity rating shortly after.
- Coordinated disclosure: we'll agree on a timeline and credit you (if you wish) once a fix ships.

## Scope

In scope: the API (`backend/`), the SPA (`frontend/`), the bot agents (`agents/`), and the
deployment configuration (Docker / compose / nginx).

Out of scope: findings that require a compromised host or physical access, best-practice
suggestions without a demonstrable impact, and vulnerabilities in third-party dependencies
that are already tracked upstream (those are handled via Dependabot).

## Handling of secrets

Never commit secrets. All credentials are supplied via environment variables
(`backend/.env`, see `backend/.env.example`). If you believe a secret has been exposed in the
git history, report it privately using the channels above so it can be rotated.
