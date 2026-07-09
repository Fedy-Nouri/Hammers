# Build the SPA, then serve it with nginx (SPA fallback + reverse-proxy to the backend).
FROM node:26-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
# Self-contained install: this package has no workspace-protocol deps, and the monorepo
# keeps a single root lockfile, so we install from frontend/package.json alone.
COPY package.json ./
RUN pnpm install
COPY . .
# Vite inlines VITE_* at build time. Empty (default) → the app uses relative /api, which
# the nginx block below reverse-proxies to the backend (same origin, no CORS needed).
# Set --build-arg VITE_API_URL=https://api.example.com for a split-origin deploy.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

# Unprivileged nginx: runs as the non-root `nginx` user (uid 101) and listens on 8080
# (a non-privileged port), with pid/temp paths already writable by that user.
FROM nginxinc/nginx-unprivileged:alpine AS production
# COPY needs root to write into /etc/nginx and the web root; drop back to nginx to run.
USER root
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
