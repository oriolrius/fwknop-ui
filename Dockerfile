# syntax=docker/dockerfile:1
#
# fwknop-ui container. Two stages:
#   1. build the Vite/React web UI into web/dist
#   2. runtime: Node server + the REAL fwknop client binary (invariant: we wrap
#      fwknop via execFile, never reimplement SPA — see CLAUDE.md).
#
# The server serves the built UI from <repo>/web/dist and listens on 8787.

# Base image pinned by digest for reproducible, supply-chain-verified builds. The
# tag is kept alongside the digest for readability; bump both together (Renovate /
# Dependabot can automate this). Digest = node:22-bookworm-slim as of 2026-07.
ARG NODE_IMAGE=node:22-bookworm-slim@sha256:53ada149d435c38b14476cb57e4a7da73c15595aba79bd6971b547ceb6d018bf

# --- Stage 1: build the web UI ---------------------------------------------
FROM ${NODE_IMAGE} AS web
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
FROM ${NODE_IMAGE} AS runtime

# The fwknop client binary. Debian bookworm ships fwknop-client 2.6.10 — the same
# client this UI shells out to. ca-certificates so OIDC discovery/JWKS over TLS works.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fwknop-client ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app/server

# Install server production deps only (devDeps are tests/mock-OIDC).
COPY server/package*.json ./
# Runtime is `node index.js` — npm is not needed after install. The npm CLI that
# ships inside the node image bundles its own vendored deps (picomatch, sigstore,
# …) which recur as HIGH/CRITICAL CVEs we can't patch; drop it in the same layer
# so it never reaches the final image (smaller + clean Trivy scan).
RUN npm ci --omit=dev \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Server source + built UI where index.js expects it (join(__dirname,'..','web','dist')).
COPY server/ ./
COPY --from=web /app/web/dist /app/web/dist

# Presets/history live here (override of server/data via FWKNOP_DATA_DIR); mount a volume.
# Run as the unprivileged `node` user (uid 1000, shipped by the base image). The
# fwknop *client* needs no elevated privileges to send SPA packets, and the app
# only writes to /data (presets/history) and ~/.fwknoprc — so /data is the only
# path that must be owned by the runtime user.
ENV FWKNOP_DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 8787
CMD ["node", "index.js"]
