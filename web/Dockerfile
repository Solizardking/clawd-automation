# Clawd Automation — Fly machine image
# Built from the REPO ROOT (see /fly.toml: dockerfile = "web/Dockerfile").
# The image ships the full monorepo so web/server.mjs can host every module.

FROM node:22-slim

# Dependencies: git (OODA journal commits), and build tools so the ESM
# runtime's native deps (better-sqlite3 etc.) can compile during `pnpm build`.
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      git ca-certificates openssl build-essential python3 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the monorepo (root-level .dockerignore excludes node_modules/dist/.env/etc.)
COPY . .

# Install runtime deps for the pieces the client drives:
#   ooda/ — the paper loop (tsx, execa, openai, chalk)
RUN npm install --prefix ooda --no-audit --no-fund

# Optional: build the ESM runtime (dist/ powers the version probe).
# Fails are non-fatal — the dashboard still runs without dist/.
RUN (command -v pnpm >/dev/null 2>&1 || npm install -g pnpm@latest --no-audit --no-fund) \
 && (pnpm install --frozen-lockfile=false --no-audit || echo "root pnpm install skipped") \
 && (pnpm build || echo "root pnpm build skipped")

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV WEB_HOST=0.0.0.0

# 24/7 paper autorun (set OODA_AUTORUN=1 at runtime to enable — fly.toml sets it)
ENV OODA_AUTORUN=0
ENV OODA_TICKS=100
ENV OODA_SLEEP=5
ENV OODA_SEED=42
ENV OODA_LLM=0
ENV OODA_GOBLIN=0
ENV OODA_JOURNAL_PATH=/data/journal/ticks.jsonl

CMD ["node", "web/server.mjs"]