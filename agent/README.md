# OpenClawd Solana Kit

A Rust toolkit for building agents that operate inside the Solana Virtual
Machine (SVM) and across EVM rails. It packages Solana transaction helpers,
wallet-scoped signing, a streaming reasoning loop, `rig-core` tool macros, and
an optional HTTP service into one crate.

The default build is **Solana-first**:

| Feature | What it gives you |
|---|---|
| `solana` (default) | Jupiter swaps, SOL/SPL transfers, balances, portfolio, token prices, Pump.fun flows, DexScreener search, local signer |
| `evm` | EVM trading, transfers, balances, approvals via `alloy` |
| `http` | Actix SSE service + Privy delegated signing (`kit` binary) |
| `cross-chain` | LiFi quotes and multichain approvals (implies `solana` + `evm`) |
| `full` | Everything above |

---

## Requirements

- **Rust** (stable, edition 2021). Install with [rustup](https://rustup.rs/).
- An **Anthropic API key** — all agents are built on `rig-core` with
  Claude 3.5 Sonnet (`ANTHROPIC_API_KEY`).
- A **private Solana RPC endpoint** is strongly recommended for trading /
  portfolio work (Helius, QuickNode, Triton, …). The public mainnet endpoint
  is the fallback.
- `solana-keygen` (part of the [Solana CLI](https://docs.anza.xyz/cli/install))
  if you want the keypair generator in `make setup`.
- On minimal Linux images, install TLS libs before building:
  `sudo apt-get install -y ca-certificates openssl libssl3`.

---

## Quick Start

One command does everything, from a clean checkout:

```bash
cd agent
make setup
```

It will:

1. Copy `.env.example` → `.env` (never overwrites an existing `.env`)
2. Generate a fresh dev keypair `keypair.json` with `solana-keygen`
   (if installed)
3. Auto-wire the keypair's base58 private key into `.env` as
   `SOLANA_PRIVATE_KEY` (`scripts/keypair_to_env.sh`, idempotent)
4. Compile-check the crate

After setup, the only value you need to add by hand is your Anthropic key:

```bash
# edit agent/.env
ANTHROPIC_API_KEY=sk-ant-...           # https://console.anthropic.com/
```

If `solana-keygen` wasn't available, `make setup` still works — it just prints
a hint, and you set `SOLANA_PRIVATE_KEY` manually in `.env` (base58 key from
any method you like).

### Run an example

```bash
make simple    # portfolio checker  → cargo run --example simple
make loop      # full reasoning loop → cargo run --example solana_agent
```

`make simple` asks "whats the portfolio looking like?" and streams the agent's
answer plus any tool calls to stdout. `make loop` runs the full
[`ReasoningLoop`](#reasoning-loop) — the loop resolves tool calls and feeds
results back to the model until it answers without calling a tool.

### Manual (non-make) commands

```bash
cargo run --example simple           # simple portfolio checker
cargo run --example solana_agent     # full reasoning loop
cargo run --features full --bin kit  # HTTP service on 0.0.0.0:6969
```

---

## Configuration

The crate auto-loads `.env` at startup (`dotenv`). All environment variables
are documented in **[`.env.example`](./.env.example)** — `make setup` copies it
to `.env`, and the crate auto-loads it via `dotenv`.

| Variable | Required for | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | everything | builds agents via `rig-core` |
| `SOLANA_RPC_URL` | solana | defaults to `https://api.mainnet-beta.solana.com` |
| `SOLANA_PRIVATE_KEY` | `LocalSolanaSigner` | base58 key — auto-filled by `make setup`; dev only |
| `ETHEREUM_RPC_URL` | evm | e.g. Arbitrum, Base |
| `ETHEREUM_PRIVATE_KEY` | evm | `0x`-prefixed hex — dev only |
| `PRIVY_APP_ID` / `PRIVY_APP_SECRET` / `PRIVY_VERIFICATION_KEY` | http | delegated signing; do not set local keys here |
| `PERPS_MODE` / `PERPS_MARKET` / `PHOENIX_PERPS_URL` / `RISE_PERPS_URL` | perps | default to paper mode |
| `SKIP_SIMULATION=1` | optional | skip tx simulation before send (faster, less safe) |
| `RUST_LOG` | optional | `error` / `warn` / `info` / `debug` / `trace` |
| `CLAWD_CONSTITUTION_PATH` / `CLAWD_RULES_PATH` / `CLAWD_KIT_ROOT` | optional | override auto-discovered constitution bundle / kit paths |

> **Security:** `SOLANA_PRIVATE_KEY` and `ETHEREUM_PRIVATE_KEY` are for local
> development only. The HTTP service intentionally uses Privy delegated
> signing and never reads local private keys. Never commit `.env`,
> `keypair.json`, or any wallet file — the repo `.gitignore` already excludes
> them.

---

## Building an agent

Every agent starts with a **signer scoped to the current async context**
(`SignerContext`). Tools only ever see the signer bound to their scope, so the
same service can safely handle many users.

```rust
use std::sync::Arc;

use openclawd_solana_kit::signer::solana::LocalSolanaSigner;
use openclawd_solana_kit::signer::SignerContext;
use openclawd_solana_kit::solana::agent::create_solana_agent;
use rig::completion::Prompt;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let signer = LocalSolanaSigner::new(std::env::var("SOLANA_PRIVATE_KEY")?);

    SignerContext::with_signer(Arc::new(signer), async {
        let agent = create_solana_agent(None).await?;
        let response = agent.prompt("what is my public key?").await?;
        println!("{response}");
        Ok(())
    })
    .await
}
```

### Available agent builders

- `create_solana_agent(preamble)` — Solana trading agent. Attaches:
  `PerformJupiterSwap`, `TransferSol`, `TransferSplToken`, `GetPublicKey`,
  `GetSolBalance`, `GetSplTokenBalance`, `FetchTokenPrice`, `GetPortfolio`,
  `SearchOnDexScreener`, `DeployPumpFunToken`, `BuyPumpFunToken`,
  `SellPumpFunToken`.
- `create_evm_agent(preamble)` — EVM trading agent (feature `evm`). Attaches
  trade, transfer, balance, and approval tools.
- `plain_agent()` — bare Claude agent with the shared Clawd preamble, no tools.

All builders ship the **Clawd constitution** (Laws I–III) in the preamble,
loaded from the monorepo `constitution/` bundle automatically.

### Built-in tools

| Area | Tools |
|---|---|
| Swaps | `PerformJupiterSwap`, `Trade` (EVM) |
| Transfers | `TransferSol`, `TransferSplToken`, `TransferEth`, `TransferErc20` |
| Balances | `GetSolBalance`, `GetSplTokenBalance`, `GetEthBalance`, `GetErc20Balance` |
| Portfolio / market | `GetPortfolio`, `FetchTokenPrice`, `SearchOnDexScreener` |
| Pump.fun | `DeployPumpFunToken`, `BuyPumpFunToken`, `SellPumpFunToken` |
| Wallet | `GetPublicKey`, `WalletAddress` |
| EVM approvals | `ApproveTokenForRouterSpend`, `VerifySwapRouterHasAllowance` |

Custom tools use the same `#[tool]` macro from `rig-tool-macro` as the
built-ins. See [docs/tools.md](docs/tools.md) for the recommended
transaction-tool shape.

---

## Reasoning Loop

`ReasoningLoop` wraps a rig agent and **streams the conversation, executing
tool calls automatically and feeding results back** until the model answers
without calling a tool.

```rust
use openclawd_solana_kit::reasoning_loop::ReasoningLoop;
use openclawd_solana_kit::solana::agent::create_solana_agent;
use openclawd_solana_kit::signer::solana::LocalSolanaSigner;
use openclawd_solana_kit::signer::SignerContext;
use rig::completion::Message;
use rig::message::UserContent;
use rig::OneOrMany;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let signer = LocalSolanaSigner::new(std::env::var("SOLANA_PRIVATE_KEY")?);
    let agent = Arc::new(create_solana_agent(None).await?);

    SignerContext::with_signer(Arc::new(signer), async {
        let loop_ = ReasoningLoop::new(agent).with_stdout(true);
        loop_.stream(
            vec![Message::User {
                content: OneOrMany::one(UserContent::text(
                    "what is the liquidity in the pool for my largest holding?",
                )),
            }],
            None, // pass an mpsc::Sender<LoopResponse> for programmatic consumption
        ).await?;
        Ok(())
    }).await
}
```

You can also run the loop with `stdout` disabled and hand it a
`tokio::sync::mpsc::Sender<LoopResponse>` to receive
`LoopResponse::Message(String)` / `LoopResponse::ToolCall { name, result }`
events as they stream. This is what the HTTP service uses.

---

## HTTP service

The `http` feature exposes a small **Server-Sent Events** service that runs a
Privy-authenticated agent per request.

```bash
make serve          # or: cargo run --features full --bin kit
```

Binds to `0.0.0.0:6969`. Endpoints:

```text
POST /stream       { prompt, chat_history, chain?: "solana", preamble? }
GET  /auth
GET  /healthz
GET  /agents        # optional agent catalog + mint endpoints
```

Stream responses:

```ts
type StreamResponse =
  | { type: "Message"; content: string }
  | { type: "ToolCall"; content: { name: string; result: string } }
  | { type: "Error"; content: string };
```

Requires `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, and `PRIVY_VERIFICATION_KEY`.
See [docs/http_service.md](docs/http_service.md) and
[docs/authentication.md](docs/authentication.md).

---

## Crate layout

```text
agent/
├── Cargo.toml
├── Makefile            # setup, examples, serve, test, docs
├── .env.example        # copy to .env and fill in
├── docs/               # mdBook documentation (see below)
├── examples/
│   ├── simple.rs       # portfolio checker
│   └── solana_agent.rs # full reasoning-loop agent
└── src/
    ├── common.rs         # shared preamble + agent builder helpers
    ├── constitution.rs   # Clawd constitution loader (auto-discovers bundle)
    ├── reasoning_loop.rs # streaming tool-call loop
    ├── signer/           # TransactionSigner trait + local/Privy implementations
    ├── solana/           # swaps, transfers, pump.fun, portfolio, tools, agent
    ├── evm/              # EVM agent + tools (feature-gated)
    ├── cross_chain/      # LiFi + approvals (feature-gated)
    ├── http/             # SSE service (feature-gated)
    ├── data/             # token data helpers
    ├── dexscreener/      # DexScreener search tool
    ├── story/            # license/tooling modules
    ├── wallet_manager/   # Privy-backed wallet store (feature-gated)
    └── bin/kit.rs        # HTTP service binary (feature-gated)
```

Embedding from another crate:

```toml
[dependencies]
openclawd-solana-kit = { path = "../agent", features = ["solana"] }
```

---

## Feature selection

```bash
make check        # solana only (default)
make check-full   # solana + evm + http + cross-chain
make test         # unit tests, default features
make test-full    # unit tests, all features
make build-full   # release-style full build
```

The `http` feature is deliberately not in `default` so library consumers don't
drag in the entire Actix/Privy stack.

---

## Documentation

The full documentation is an [mdBook](https://rust-lang.github.io/mdBook/) in
[`docs/`](docs/):

| Page | Covers |
|---|---|
| [Introduction](docs/introduction.md) | design goals, constitution |
| [Installation](docs/installation.md) | build + embed instructions |
| [Configuration](docs/configuration.md) | all env vars |
| [Quickstart](docs/quickstart.md) | 60-second start |
| [Tools](docs/tools.md) | `#[tool]` macro + tx-tool pattern |
| [SignerContext](docs/signer_context.md) | per-request signer scoping |
| [Solana](docs/solana.md) | SVM agent reference |
| [Perps](docs/perps.md) | Phoenix/Rise paper-first flows |
| [HTTP Service](docs/http_service.md) | SSE service + smoke test |
| [Authentication](docs/authentication.md) | Privy auth + JWT flow |

Serve locally:

```bash
make docs
```

---

## Testing

```bash
make test        # default features
make test-full   # all features
```

The test suite includes structural "module graph" tests that verify core
modules are reachable, the Solana graph (blockhash cache + signer) compiles,
and the Clawd constitution is embedded in agent preambles. Constitution tests
require the monorepo `constitution/` bundle, which is already present in this
repository.

## License

MIT