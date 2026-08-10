# OODA

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=800&size=18&duration=1700&pause=350&color=FFD166&center=true&vCenter=true&width=900&lines=observe+%E2%86%92+orient+%E2%86%92+decide+%E2%86%92+act;market+loop+state+and+TUI+for+agent+control" alt="OODA animated header" />
</p>

`ooda/` is the local observe-orient-decide-act harness inside the **`@onchainai/automation`** monorepo (`@clawd/ooda-harness`). It powers paper pulse checks, journals, and optional TUI output.

**Paper-trading and devnet only** — no real funds, no mainnet connections, no key handling.

Bridged into the Automaton runtime via `src/ooda/bridge.ts` (`getOodaHealth`, `ooda_health` tool).

## Quickstart

```bash
# From monorepo root or this directory
cd ooda
npm install
npm run lint                                     # tsc --noEmit
npm test                                         # real unit tests (state/validate/observe/decision/TUI)

npm run loop -- --ticks 50 --sleep 0.25          # deterministic, no TUI
npm run loop -- --ticks 200 --sleep 0.4 --tui | npm run tui
npm run loop -- --goblin --ticks 100 --llm       # aggressive paper/devnet mode

# Isolated journal path for CI / concurrent runs (do not clobber journal/ticks.jsonl)
OODA_JOURNAL_PATH=./journal/ci-ticks.jsonl npm run loop -- --ticks 5 --sleep 0 --seed 42

# From monorepo root
npx tsx ooda/loop.ts --ticks 100 --sleep 0.25
npx tsx ooda/loop.ts --ticks 200 --sleep 0.4 --tui | npx tsx ooda/tui.ts
npx tsx ooda/loop.ts --goblin --ticks 100 --llm
```

## Web dashboard + 24/7 Fly deploy

A zero-dependency browser dashboard lives at `ooda/web/`:

```bash
npm run web            # starts on http://127.0.0.1:4173
OODA_WEB_PORT=4321 npx tsx web/server.ts
```

**Pages**

- `/` — paper dashboard: live price chart, stat cards, positions table, tick feed, run form (ticks/sleep/seed, goblin + LLM toggles), SSE-driven. Tails `journal/ticks.jsonl` for ANY run (including ones started from the CLI in another terminal).
- `/trade.html` — live (mainnet) trading page: connect a Phantom wallet, get DFlow quotes/unsigned txs via `/api/live/*`, sign & send in the wallet. The server never holds a private key — only proxies quotes/confirmation (Helius fallback RPC).

**Endpoints**: `GET /api/status`, `GET /api/config`, `GET /api/journal?n=`, `GET /api/stream` (SSE), `POST /api/run`, `POST /api/stop`, `GET /api/live/status`, `GET /api/live/order`, `GET /api/live/balance`, `GET /api/live/confirm`, `GET /api/agent/status`, `POST /api/agent/act`.

**24/7 deployment (Fly.io)** — runs the paper loop forever with a persistent journal:

```bash
cd ooda
fly launch --copy-config --no-deploy --name clawd-ooda --region iad
fly volumes create ooda_journal --size 1 --region iad
fly secrets set SOLANA_RPC_URL=https://api.devnet.solana.com
fly secrets set OPENAI_API_KEY=...     # optional — enables --llm decisions
fly deploy
```

Config lives in [`fly.toml`](fly.toml) + [`Dockerfile`](Dockerfile): binds `0.0.0.0`, honors Fly-injected `PORT`, mounts the journal volume at `/data/journal/ticks.jsonl`, and sets `OODA_AUTORUN=1` so `loop.ts` reruns forever (default 500 ticks @ 5s = ~42 min/run, then auto-restarts). Watch it live at `https://clawd-ooda.fly.dev/`.

| Fly env var | Meaning |
| --- | --- |
| `OODA_AUTORUN=1` | continuously rerun the paper loop |
| `OODA_TICKS` / `OODA_SLEEP` | ticks per run / seconds between ticks |
| `OODA_SEED` | deterministic seed |
| `OODA_LLM` / `OODA_GOBLIN` | enable LLM / goblin mode on the deployed loop |
| `OODA_JOURNAL_PATH` | journal path (defaults to the `/data` volume) |

The deployed loop is **paper + devnet only** — `observe.ts` rejects mainnet RPC URLs at startup and that guard is never bypassed. The live-trading page remains browser-wallet-signed and is unchanged by deployment.

## OpenClawd Solana Kit bridge — automated trading for any Solana token

`web/agent-kit.ts` proxies `/api/agent/*` to a running
[`OpenClawd-agent-kit`](../OpenClawd-agent-kit) `kit` HTTP service
(`cargo run --features full --bin kit`), which exposes a dedicated
`POST /agent/act` route for exactly this kind of server-to-server caller —
no Privy user session required, unlike `/stream`. This is a third,
independent surface alongside the paper loop and the DFlow live page: the
core OODA loop (`loop.ts`) is untouched and stays paper/devnet-only.

- `GET /api/agent/status` — reports whether `AGENT_KIT_URL` /
  `AGENT_BRIDGE_KEY` are configured and, if so, proxies the kit's
  `/agent/health`.
- `POST /api/agent/act` `{ instruction, preamble? }` — forwards the
  instruction to the kit with the `X-Agent-Key` shared secret and returns its
  full tool-call trace. The kit signs with its own wallet
  (`SOLANA_PRIVATE_KEY` on the kit side) and routes through Jupiter /
  pump.fun, so `instruction` can name **any SPL token by mint address** —
  e.g. `"buy 0.05 SOL of <mint>"` or `"what's my SOL balance?"`.

Neither this server nor the browser ever holds the kit's signing key — only
the shared `AGENT_BRIDGE_KEY` secret is forwarded, same custody model as the
DFlow live page (server proxies, never signs). Both `AGENT_KIT_URL` and
`AGENT_BRIDGE_KEY` must be set or every `/api/agent/*` call reports
unconfigured (503) — this bridge is opt-in and does nothing until wired up.

```bash
# Point ooda at a locally-running kit
AGENT_KIT_URL=http://127.0.0.1:6969 AGENT_BRIDGE_KEY=<same value as the kit's AGENT_BRIDGE_KEY> npm run web

# On Fly, point the deployed ooda app at a deployed kit app
fly secrets set --app clawd-ooda AGENT_KIT_URL=https://<your-kit-app>.fly.dev AGENT_BRIDGE_KEY=...
```

See [`../OpenClawd-agent-kit/README.md`](../OpenClawd-agent-kit/README.md#http-service)
for how to run/deploy the kit side and generate `AGENT_BRIDGE_KEY`.

## Architecture

```text
ooda/
├── loop.ts          ← main harness (CLI entry point)
├── observe.ts       ← market data adapters (synth + Helius/Pyth stub)
├── state.ts         ← position book, PnL accounting, type definitions
├── validate.ts      ← safety validator (enforces CLAWD.md rules)
├── clawd-decision.ts← AI decision function (multi-provider LLM chain)
├── journal.ts       ← append-only tick journal writer/reader
├── tui.ts           ← ANSI TUI dashboard (reads JSONL from loop.ts --tui)
├── CLAWD.md         ← per-tick system prompt + config frontmatter
├── goblin.md        ← GOBLIN MODE variant config
├── test/            ← real unit tests (npm test)
└── journal/
    └── ticks.jsonl  ← append-only operational state
```

## Automaton agent tools

The monorepo runtime (`@onchainai/automation`) bridges this package via
`src/ooda/bridge.ts` and exposes **first-class tools** to the agent loop:

| Tool | Purpose |
|------|---------|
| `ooda_health` | Health + catalog of this package |
| `ooda_run` | Run N deterministic paper ticks in-process (no LLM) |
| `ooda_decide` | One-shot SMA decision from candle closes |
| `ooda_journal` | Read trailing `journal/ticks.jsonl` entries |

All tools are **paper / devnet only** — same safety contract as this harness.
Integrated with Dark Clawd automaton lineage (creator CLI + crustacean installer at monorepo root).

## File Reference

### `loop.ts` — Main Harness

The orchestrator. Runs the OODA cycle for N ticks:

1. **Observe** — calls `SynthObserver.tick()` (or Helius/Pyth when wired), optionally fetches a perps OI signal from `../perps/clawd-agents-perps/`
2. **Orient/Decide** — calls `clawdDecision()` (LLM) or `deterministicDecision()` (SMA crossover) or `signalToDecision()` (perps OI)
3. **Validate** — passes raw decision through `validate()` before applying
4. **Act** — `openPosition` / `closePosition` / hold
5. **Journal** — appends every tick to `journal/ticks.jsonl`

**CLI flags:**

| Flag | Default | Description |
| --- | --- | --- |
| `--ticks N` | 50 | Number of ticks to run |
| `--sleep N` | 0.25 | Seconds between ticks |
| `--seed N` | 42 | PRNG seed for synth candles |
| `--llm` | false | Use LLM for decisions |
| `--tui` | false | Emit JSONL for TUI renderer |
| `--goblin` | false | Enable GOBLIN MODE |
| `--perps-oi` | false | Fetch live OI signal from perps module |
| `--perps-symbol` | SOL-PERP | Symbol for perps OI fetch |
| `--perps-oi-mock` | false | Use mock data for OI signal |
| `--commit-every N` | 0 | Git-commit journal every N ticks |

**Kill-switch:** exits with code `1` after `loss_killswitch_consecutive` consecutive losing trades. Configurable in `CLAWD.md` frontmatter.

---

### `observe.ts` — Market Data

- **`SynthObserver`** — seeded deterministic candle generator using `mulberry32` PRNG. Produces OHLCV candles with a slight upward drift. Used by default.
- **`observeFromHelius()`** — stub for a real Pyth/Helius RPC adapter. Falls back to synth until wired.
- **`rejectMainnet(rpcUrl)`** — hard guard; throws on any mainnet RPC URL (bypassed only with `MAINNET_OK=1`).
- **`isStale(candles)`** — staleness check; returns `true` if the last candle is older than `maxAgeSeconds`.

To plug in real data, replace `SynthObserver` usage in `loop.ts` with a call to `observeFromHelius()` once the Pyth account decode is implemented.

---

### `state.ts` — Position Book

In-memory state for one loop run. Reconstructed from `journal/ticks.jsonl` on restart.

**Types:** `Side`, `Position`, `Book`, `Candle`, `State`

**Functions:**

- `createState(startingCash)` — initialize with 10 SOL-equivalent cash
- `openPosition(state, side, size_lamports, currentPrice)` — deducts cash, appends to book
- `closePosition(state, positionId, currentPrice)` — computes PnL (long: profit on price rise; short: profit on price fall), updates `consecutive_losses` / `total_pnl_lamports`
- `unrealisedPnl(state, currentPrice)` — sum of unrealised PnL across open positions

---

### `validate.ts` — Decision Validator

Called on every raw LLM or deterministic output before any state mutation. Invalid decisions are logged as `"rejected"` and the tick proceeds as a `hold`.

**Enforces:**

- `action` must be `hold | open | close`
- `reason` required, max 140 chars
- Prompt-injection guard: rejects reasons containing `private_key`, `seed phrase`, `mnemonic`, etc.
- `open.side` must be `long | short`
- `open.size_lamports` must be a positive integer ≤ `max_position_size_lamports`
- v0: one position at a time (rejects `open` when a position is already open)
- `close.position_id` must exist in the book

**`parseClawdConfig(markdownContent)`** — extracts the YAML frontmatter from `CLAWD.md` / `goblin.md` and validates that `mode=paper` and `network=devnet`.

---

### `clawd-decision.ts` — AI Decision

Assembles the per-tick prompt from `CLAWD.md` + live observations and calls an LLM. Returns one parsed JSON decision.

**Provider priority (uses first key found):**

1. `XAI_API_KEY` → `grok-4.3-fast` (or `XAI_MODEL`)
2. `DEEPSEEK_API_KEY` → `deepseek-v4-flash` (via `DEEPSEEK_BASE_URL`)
3. `ZKROUTER_API_KEY` (or `OPENROUTER_API_KEY`) → `nex-agi/nex-n2-pro:free` via `ZKROUTER_BASE_URL`
4. `ANTHROPIC_API_KEY` → `claude-haiku-4-5-20251001` (or `ANTHROPIC_MODEL`)
5. **Fallback** → `deterministicDecision()` (no key needed)

**`deterministicDecision(obs)`** — 5-candle SMA crossover: opens long when price < SMA × 0.995, opens short when price > SMA × 1.005, closes on reversal. No API key required.

The prompt is assembled fresh each tick — stateless, no conversation history.

### `package.json` — local harness metadata

The `ooda/` directory now carries its own `package.json` so the harness is reproducible as an open-source subproject. It declares the actual runtime dependencies used here:

- `openai` for the OpenAI-compatible router slot
- `execa` for optional journal commits
- `chalk` for the ANSI TUI
- `tsx` and `typescript` for local execution and linting

---

### `journal.ts` — Tick Journal

Append-only JSONL log at `journal/ticks.jsonl`. Every tick (including rejected and killswitch ticks) is written as one JSON line.

**`TickEntry` fields:** `tick`, `now`, `candles_last3`, `book_snapshot`, `decision`, `outcome` (`applied | rejected | killswitch`), `violation?`, `pnl_lamports?`, `total_pnl_lamports?`, `consecutive_losses?`, `event?`

**Functions:**

- `appendTick(entry)` — creates `journal/` dir if needed, appends one JSON line
- `readLastEntries(n)` — returns last N entries (injected into the next tick's observations)
- `clearJournal()` — marks empty for a fresh run (non-destructive)
- `journalPath()` — returns the absolute path for display

The journal is the harness's memory. On restart, replay it to reconstruct state.

> Review `ooda/journal/` before committing if you run long live sessions.

---

### `tui.ts` — ANSI Dashboard

Reads JSONL from `loop.ts --tui` on stdin and renders a live dark-themed dashboard with chalk.

**Features:**

- Full-width box-drawing border (magenta)
- Tick progress bar
- SOL price with unicode sparkline (`▁▂▃▄▅▆▇█`) coloured green/red per move
- Last decision + outcome
- PnL / cash / open positions / consecutive losses stats row
- Rolling 6-line action log with timestamps
- Kill-switch and done banners

**Pipe usage:**

```bash
npx tsx ooda/loop.ts --ticks 200 --sleep 0.4 --tui | npx tsx ooda/tui.ts
```

---

### `CLAWD.md` — Per-Tick Prompt

Config frontmatter + system prompt loaded by `loop.ts` each run (and by `clawd-decision.ts` each tick).

**Frontmatter keys:**

```yaml
mode: paper                        # must be "paper"
network: devnet                    # must be "devnet"
max_action_per_tick: 1
max_position_size_lamports: 1000000
loss_killswitch_consecutive: 3
```

The body is the LLM's instruction set: what decisions it can return, the hard rules it must follow, and the strategy guidelines (SMA, mean reversion, OI delta, quick loss cuts).

---

### `goblin.md` — GOBLIN MODE

```yaml
mode: paper
network: devnet
max_position_size_lamports: 5000000   # 5× normal
loss_killswitch_consecutive: 5
goblin: true
dark_defi_armed: true
tick_sleep_ms: 0
model: grok-4.3-fast
```

Activated with `--goblin`. Loads `goblin.md` instead of `CLAWD.md`, forces `--llm`, sets sleep to 0ms, and defaults to 100 ticks. Same safety contract (paper + devnet), but maximally aggressive strategy:

- Aggressive mean reversion on 3-tick windows
- Momentum continuation on 2+ same-direction ticks
- Take profit at +1%, cut loss at -0.5%
- Follows OI expansion with price, fades OI expansion against price

---

## Safety Contract

All enforced in code — not just prompt guidance:

- `mode: paper` and `network: devnet` are validated at startup; any other value throws
- Mainnet RPC URLs are rejected before any network call
- No private key handling exists anywhere in this module
- Position size is hard-capped per tick
- One position at a time (v0)
- Kill-switch halts the process on consecutive losses
- Every decision (including rejected ones) is journalled

The above governs the core harness (`loop.ts`, `state.ts`, `observe.ts`,
`validate.ts`) and is never bypassed by the web dashboard. The dashboard adds
two opt-in, explicitly-invoked live surfaces that are proxies only — neither
holds a signing key: `/api/live/*` (`web/live.ts`, DFlow quotes for a
browser wallet to sign) and `/api/agent/*` (`web/agent-kit.ts`, forwards to
the OpenClawd kit's own signer via a shared secret). Both report
unconfigured/502 until their env vars are set.

## Environment Variables

| Variable | Used by | Description |
| --- | --- | --- |
| `OODA_JOURNAL_PATH` | journal | Override JSONL path (tests/CI isolation) |
| `XAI_API_KEY` | clawd-decision | Grok API key (priority 1) |
| `XAI_MODEL` | clawd-decision | Override Grok model |
| `DEEPSEEK_API_KEY` | clawd-decision | DeepSeek key (priority 2) |
| `DEEPSEEK_BASE_URL` | clawd-decision | DeepSeek base URL |
| `ZKROUTER_API_KEY` | clawd-decision | Preferred Clawd router key on the public zk.x402.wtf stack (priority 3) |
| `ZKROUTER_BASE_URL` | clawd-decision | Override the default router base (`https://clawdrouter-zk.fly.dev/v1`) |
| `OPENROUTER_API_KEY` | clawd-decision | Compatibility fallback for the same OpenAI-format router slot |
| `OPENROUTER_MODEL` | clawd-decision | Override the router model |
| `ANTHROPIC_API_KEY` | clawd-decision | Claude key (priority 4) |
| `ANTHROPIC_MODEL` | clawd-decision | Override Claude model |
| `SOLANA_RPC_URL` | loop | RPC URL (mainnet URLs rejected) |
| `MAINNET_OK` | observe | Set to `1` to bypass mainnet guard (still no signing path) |
| `OODA_WEB_PORT` / `OODA_WEB_HOST` | web | Dashboard bind (Fly injects `PORT`, default host `0.0.0.0`) |
| `OODA_AUTORUN` / `OODA_TICKS` / `OODA_SLEEP` / `OODA_SEED` / `OODA_LLM` / `OODA_GOBLIN` | web | 24/7 autorun daemon config (Fly) |
| `DFLOW_API_KEY` | web/live | DFlow prod host + API key for live quotes |
| `HELIUS_API_KEY` / `HELIUS_RPC_URL` | web/live | Helius balance/confirmation (falls back to public RPC) |
| `BIRDEYE_API_KEY` | web/agent-kit | Forwarded to the kit for token-safety / liquidity screening before a swap |
| `JUPITER_API_KEY` | web/agent-kit | Forwarded to the kit so Jupiter swaps authenticate against `api.jup.ag` (paid tier) |
| `AGENT_KIT_URL` | web/agent-kit | Base URL of a running OpenClawd-agent-kit `kit` HTTP service, e.g. `http://127.0.0.1:6969` |
| `AGENT_BRIDGE_KEY` | web/agent-kit | Shared secret forwarded as `X-Agent-Key` to the kit's `/agent/act`; must match the kit's own `AGENT_BRIDGE_KEY` |

## Monorepo integration

| Surface | Role |
| --- | --- |
| `pnpm-workspace.yaml` | Lists `"ooda"` workspace package |
| Root `package.json` `files` | Ships `ooda` with the Automaton pack |
| `src/ooda/bridge.ts` | `getOodaHealth()` / catalog for boot + tools |
| Tool | `ooda_health` on the Automaton primary tools surface |

```bash
# From monorepo root (after npm run build)
node -e "import('./dist/ooda/bridge.js').then(m=>console.log(m.getOodaHealth()))"
```
