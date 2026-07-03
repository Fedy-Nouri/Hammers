# Build the SPA, then serve it with nginx (SPA fallback + reverse-proxy to the backend).
FROM node:20-alpine AS builder
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

FROM nginx:alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
