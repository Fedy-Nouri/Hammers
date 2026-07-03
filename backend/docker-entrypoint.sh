#!/bin/sh
set -e

# Apply any pending migrations before the app starts, so a fresh container (or a new
# release) converges the schema without a manual step. `migrate deploy` is idempotent
# and never generates/drops — safe to run on every boot.
echo "[entrypoint] Applying database migrations..."
pnpm prisma:migrate:deploy

echo "[entrypoint] Starting server..."
# nest build (sourceRoot: src) emits the entry at dist/src/main.js.
exec node dist/src/main
