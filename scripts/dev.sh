#!/usr/bin/env bash
#
# One-command local dev: starts postgres + redis (Docker), then runs the backend,
# frontend, and both agents (meeting-bot, job-bot) concurrently with labeled, colored
# logs. Ctrl+C tears the whole thing down.
#
#   pnpm dev                 # everything
#   pnpm dev -- --no-bots    # backend + frontend only
#   pnpm dev -- --no-infra   # assume postgres/redis are already running
#
set -uo pipefail
cd "$(dirname "$0")/.."

START_INFRA=1
START_BOTS=1
for arg in "$@"; do
  case "$arg" in
    --no-infra) START_INFRA=0 ;;
    --no-bots)  START_BOTS=0 ;;
    -h|--help)
      cat <<'USAGE'
One-command local dev: postgres + redis (Docker), then backend, frontend, and
both agents (meeting-bot, job-bot) with labeled logs. Ctrl+C stops everything.

  pnpm dev                 # everything
  pnpm dev -- --no-bots    # backend + frontend only
  pnpm dev -- --no-infra   # assume postgres/redis are already running
USAGE
      exit 0 ;;
    *) echo "[dev] unknown option: $arg (try --help)"; exit 1 ;;
  esac
done

log() { printf '\033[1;34m[dev]\033[0m %s\n' "$*"; }

# --- infra: postgres + redis via docker compose ---
if [ "$START_INFRA" -eq 1 ]; then
  if docker info >/dev/null 2>&1; then
    log "starting postgres + redis..."
    docker compose up -d postgres redis >/dev/null
    log "waiting for postgres to be healthy..."
    for _ in $(seq 1 60); do
      [ "$(docker inspect -f '{{.State.Health.Status}}' hammers_postgres 2>/dev/null)" = "healthy" ] && break
      sleep 1
    done
  else
    log "Docker is not running — skipping infra. Start postgres/redis yourself, or pass --no-infra."
  fi
fi

# Colored, prefixed log stream for one service (reads stdin line by line).
prefix() { # $1=label  $2=ansi-color
  local label=$1 color=$2
  while IFS= read -r line; do
    printf '\033[%sm[%-11s]\033[0m %s\n' "$color" "$label" "$line"
  done
}

# Kill the whole process group on exit so Ctrl+C stops every child (nest/vite/ts-node).
# Leaves the postgres/redis containers running; stop them with `docker compose stop`.
trap 'echo; log "shutting down (postgres/redis left running)"; kill 0 2>/dev/null' INT TERM EXIT

log "launching services — Ctrl+C to stop"
( pnpm --filter backend  dev 2>&1 | prefix backend  36 ) &   # cyan
( pnpm --filter frontend dev 2>&1 | prefix frontend 35 ) &   # magenta
if [ "$START_BOTS" -eq 1 ]; then
  ( pnpm --filter meeting-bot dev 2>&1 | prefix meeting-bot 33 ) &        # yellow
  ( cd agents/job-bot && pnpm dev 2>&1 | prefix job-bot 32 ) &           # green
fi

wait
