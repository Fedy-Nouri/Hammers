FROM node:20-alpine AS builder
WORKDIR /app
# openssl: Prisma needs it to generate the client on Alpine (musl).
RUN apk add --no-cache openssl
RUN npm install -g pnpm
# Self-contained install: this pnpm workspace keeps a single root lockfile and the backend
# has no workspace-protocol deps, so we install from backend/package.json alone.
COPY package.json ./
RUN pnpm install
COPY . .
# Generate the Prisma client against the real schema before compiling — pnpm install's
# postinstall ran before the schema was copied, so the client would be missing models.
RUN pnpm prisma:generate
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
# Drop root: the node:alpine image ships a non-root `node` user (uid 1000). Everything the
# runtime touches (dist, prisma engines in node_modules, migrate deploy over the network) is
# world-readable and needs no write access, so the server runs unprivileged.
USER node
EXPOSE 3000
# Entrypoint runs `prisma migrate deploy`, then `node dist/src/main`.
ENTRYPOINT ["./docker-entrypoint.sh"]
