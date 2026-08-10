# ────────────────────────────────────────────────────────────────────────────
# OpenClawd Solana Kit — `kit` HTTP service, deployable as a companion Fly.io
# app to https://clawd-ooda.fly.dev (see ../ooda/web/agent-kit.ts).
#
# Builds with `http,solana` only — enough for the Solana trading agent + the
# /agent/act automation bridge, without pulling in the EVM/alloy toolchain.
# Pass --build-arg FEATURES=full to include evm/cross-chain instead.
#
# Requires (on the host):
#   fly launch --copy-config --no-deploy --name clawd-agent-kit --region iad
#   fly secrets set ANTHROPIC_API_KEY=... SOLANA_RPC_URL=... \
#     SOLANA_PRIVATE_KEY=... AGENT_BRIDGE_KEY=... JUPITER_API_KEY=... \
#     HELIUS_API_KEY=... BIRDEYE_API_KEY=...
#   fly deploy
# ────────────────────────────────────────────────────────────────────────────

FROM rust:1-bookworm AS builder
ARG FEATURES=http,solana

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY examples ./examples

RUN cargo build --release --no-default-features --features "${FEATURES}" --bin kit

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /build/target/release/kit ./kit

EXPOSE 6969
CMD ["./kit"]
