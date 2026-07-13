# syntax=docker/dockerfile:1
#
# fwknop-ui container. Two stages:
#   1. build the Vite/React web UI into web/dist
#   2. runtime: Node server + the REAL fwknop client binary (invariant: we wrap
#      fwknop via execFile, never reimplement SPA — see CLAUDE.md).
#
# The server serves the built UI from <repo>/web/dist and listens on 8787.

# --- Stage 1: build the web UI ---------------------------------------------
FROM node:22-bookworm-slim AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
# The docs live at the repo root and are inlined into the bundle by import.meta.glob
# ('../../docs/**/*.md' → /app/docs from /app/web/src). They must be present at build.
COPY docs/ /app/docs/
# vite.config.ts reads the version from the root package.json (single source of truth
# for __APP_VERSION__); it must exist at /app/package.json at build time.
COPY package.json /app/package.json
RUN npm run build            # → /app/web/dist

# --- Stage 2: runtime -------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# The fwknop client binary. Debian bookworm ships fwknop-client 2.6.10 — the same
# client this UI shells out to. ca-certificates so OIDC discovery/JWKS over TLS works.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fwknop-client ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app/server

# Install server production deps only (devDeps are tests/mock-OIDC).
COPY server/package*.json ./
RUN npm ci --omit=dev

# Server source + built UI where index.js expects it (join(__dirname,'..','web','dist')).
COPY server/ ./
COPY --from=web /app/web/dist /app/web/dist

# Presets/history live here (override of server/data via FWKNOP_DATA_DIR); mount a volume.
ENV FWKNOP_DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 8787
CMD ["node", "index.js"]
