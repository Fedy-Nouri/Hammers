FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
# Self-contained install: this pnpm workspace keeps a single root lockfile and the backend
# has no workspace-protocol deps, so we install from backend/package.json alone.
COPY package.json ./
RUN pnpm install
COPY . .
RUN pnpm build

FROM node:20-alpine AS production
WORKDIR /app
# openssl: Prisma's query + migration engines need it on Alpine (musl).
# curl:    used by the compose/orchestrator healthcheck against /api/health.
RUN apk add --no-cache openssl curl
RUN npm install -g pnpm
COPY package.json ./
RUN pnpm install --prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# prisma CLI is a prod dependency now, so generate (build) and migrate deploy (runtime) both work.
RUN pnpm prisma:generate
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
# Entrypoint runs `prisma migrate deploy`, then `node dist/main`.
ENTRYPOINT ["./docker-entrypoint.sh"]
