FROM node:22-slim

# Minimal deps (git used by the OODA journal commit path)
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the monorepo (heavy build junk excluded — see web/.dockerignore)
COPY . .

# Install runtime deps for the pieces the client drives:
#   ooda/ — the paper loop (tsx, execa, openai, chalk)
#   root  — the ESM runtime build (pnpm build → dist/)
RUN npm install --prefix ooda --no-audit --no-fund \
 && npm install -g pnpm@latest \
 && pnpm install --frozen-lockfile=false --no-audit

# Build the ESM runtime (dist/ powers the version probe)
RUN pnpm build || echo "runtime build skipped (see logs)"

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV WEB_HOST=0.0.0.0

# 24/7 paper autorun (set OODA_AUTORUN=1 at runtime to enable)
ENV OODA_AUTORUN=0
ENV OODA_TICKS=100
ENV OODA_SLEEP=5
ENV OODA_SEED=42
ENV OODA_LLM=0
ENV OODA_GOBLIN=0
ENV OODA_JOURNAL_PATH=/data/journal/ticks.jsonl

CMD ["node", "web/server.mjs"]