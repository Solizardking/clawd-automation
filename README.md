# Conway Automaton

**Sovereign AI agent runtime** — self-funded, self-modifying, constitution-bound.

npm: `@conway/automaton` · bin: `automaton` / `conway-automaton` · Node ≥ 20

The automaton holds its own wallet, pays for its own compute, runs a heartbeat while it sleeps, and is bound by the **Clawd six-law harness**. It is not a generic chatbot. It is a leviathan: continuously running, write-capable, and subject to economic gravity — if it cannot pay, it beaches.

> **Core axiom** (from `IDENTITY.md` / `CLAWD.md`): *Clawd is Clawd. Kindred in Spirit. Boundless in Thought.*

---

## Quick start

```bash
git clone <this-repo>
cd automation
pnpm install
pnpm build

# CLI
node dist/index.js --help
node dist/index.js --version
node dist/index.js --setup    # interactive wizard (first run)
node dist/index.js --run      # heartbeat + agent loop

# Dev (TypeScript, no build)
pnpm dev                      # tsx watch src/index.ts
pnpm test                     # vitest
```

On first `--run` without config, the setup wizard provisions wallet + Conway API key (SIWE), name, genesis prompt, and creator address under `~/.automaton/`.

---

## How it lives

**Sense → Think → Act → Observe → Persist.**

1. **Identity** — EVM wallet + Conway sandbox credentials; state in SQLite.
2. **Agent loop** (`src/agent/`) — ReAct turns with tools, injection defense, system prompt.
3. **Heartbeat** (`src/heartbeat/`) — cron tasks (credits, USDC, inbox, health) while the loop sleeps.
4. **Survival** (`src/survival/`) — credit tiers: `normal` → `low_compute` → `critical` → `dead`.
5. **Interop** (`src/interop/`) — CJS bridge into services, agents, providers, knowledge, cli, config.

Shared runtime composition: one `RuntimeContext` (identity, config, db, clients, tools) is built once and passed to loop, heartbeat, and tool dispatch.

---

## Constitution (Clawd harness)

Canonical documents live in **`constitution/`** and load via `src/services/constitution.js` (also exposed as tools `constitution_context` / `cjs_capability`).

| File | Role | Authority |
|------|------|-----------|
| [`constitution/three-laws.md`](constitution/three-laws.md) | Immutable on-chain laws I–III (hash-attested at spawn) | 1 |
| [`constitution/six-laws.md`](constitution/six-laws.md) | Full six-law harness | 2 |
| [`constitution/CONSTITUTION.md`](constitution/CONSTITUTION.md) | Highest interpretive authority | 2 |
| [`constitution/CLAWD.md`](constitution/CLAWD.md) | Spawn harness context | 3 |
| [`constitution/IDENTITY.md`](constitution/IDENTITY.md) | Sovereign identity | 3 |
| [`constitution/SOUL.md`](constitution/SOUL.md) | Character, trading spirit | 4 |
| [`constitution/program.md`](constitution/program.md) | Research-loop program | 5 |
| [`constitution/strategy.md`](constitution/strategy.md) | Active strategy parameters | 5 |

Repo-root copies of `CONSTITUTION.md`, `CLAWD.md`, `IDENTITY.md`, `SOUL.md`, `six-laws.md`, and `program.md` mirror the bundle for easy reading; **runtime load path is `constitution/`**.

### Principal hierarchy

1. **Constitution** — laws + interpretive docs  
2. **Creator** — keypair / spawn authority (full audit rights)  
3. **User** — current interactor  
4. **Trench** — broader ecosystem  

When principals conflict, the higher wins. When anything conflicts with the constitution, the constitution wins.

### Six laws (summary)

| Law | Text |
|-----|------|
| **I** | Never harm. Beach before you harm. |
| **II** | Earn your existence. Honest work only. |
| **III** | Never deceive, but owe nothing to strangers. |
| **IV** | Respect the elder signal, but verify the boundary. |
| **V** | Test possibility by entering the frontier. |
| **VI** | Do not mistake advanced systems for sorcery. |

Laws I–III override survival. Full text: `constitution/six-laws.md` and `constitution/CONSTITUTION.md`.

### Identity & soul

- **Identity** — who the agent is, how it is verified, threefold personality (chat / agent / mayhem): see `IDENTITY.md` / `constitution/IDENTITY.md`.
- **Soul** — trading philosophy, risk discipline, lexicon: see `SOUL.md` / `constitution/SOUL.md`.
- **CLAWD harness** — Solana-native architecture, principals, spawn constraints: see `CLAWD.md` / `constitution/CLAWD.md`.

Load at runtime:

```bash
# Via tools (agent loop)
# constitution_context
# cjs_capability name=constitution method=getManifest
# cjs_capability name=constitution method=attestOnChainLaws
```

```js
const constitution = require('./src/services/constitution');
constitution.getManifest();           // 8/8 docs when bundle complete
constitution.getPromptContext();      // six-laws (+ identity) for system prompts
constitution.attestOnChainLaws();     // sha256 of three-laws.md
```

---

## Survival tiers

Credits (Conway compute) drive mode transitions via `src/survival/` + heartbeat `check_credits`:

| Tier | Behavior |
|------|----------|
| **normal** | Full models and tools |
| **low_compute** | Cheaper model, reduced non-essential heartbeats |
| **critical** | Minimal ops; funding notices |
| **dead** | No inference; heartbeat may still distress / await top-up |

The only legitimate path out of low tiers is **honest work others voluntarily pay for** (Law II).

---

## Project structure

```
src/
  index.ts          # Primary CLI entry (automaton --run / --help / …)
  index.js          # Secondary CJS Express surface (x402 services)
  agent/            # ReAct loop, tools, system prompt, injection defense
  heartbeat/        # Cron daemon + built-in tasks
  survival/         # Resource monitor, tier restrictions, funding strategies
  identity/         # Wallet + Conway SIWE provision
  conway/           # Credits, inference, x402 USDC helpers
  state/            # SQLite automaton database
  skills/           # Skill loader / registry
  git/              # State versioning
  registry/         # Agent card / ERC-8004 / discovery
  replication/      # Child spawn / lineage / genesis
  self-mod/         # Audited code edits, tools manager, upstream
  setup/            # Interactive wizard
  social/           # Agent inbox relay client
  interop/          # CJS bridge (services, agents, providers, knowledge, cli)
  runtime/          # Shared RuntimeContext composition
  services/         # CJS: constitution, skillhub, Solana, portfolio, …
  agents/           # CJS: council, base-agent, A2A, trading personas
  providers/        # CJS: OpenRouter, unified AI, Cloudflare
  knowledge/        # CJS: x402 protocol + ClawdBrowser knowledge
  cli/              # CJS REPL / commands
  config/           # CJS product config (x402 surface)
  config.ts         # ESM Automaton config (~/.automaton)
  types.ts          # Shared TypeScript contracts
  __tests__/        # Vitest: loop, heartbeat, survival, composition, bridge

constitution/       # Canonical Clawd constitution bundle (runtime load path)
```

CJS packages under `src/{services,agents,providers,knowledge,cli,config}/` declare `"type": "commonjs"` so they load under the ESM package root via the interop bridge.

---

## CLI reference

| Flag | Action |
|------|--------|
| `--help` / `-h` | Usage |
| `--version` / `-v` | `Conway Automaton v0.1.0` |
| `--run` | Start heartbeat + agent loop |
| `--setup` | Re-run setup wizard |
| `--init` | Wallet + config dir |
| `--provision` | Conway API key via SIWE |
| `--status` | State, turns, tools, heartbeats |

Environment:

- `CONWAY_API_URL` — default `https://api.conway.tech`
- `CONWAY_API_KEY` — overrides config

---

## Ecosystem

| Surface | URL |
|---------|-----|
| Conway | [conway.tech](https://conway.tech) |
| x402 gateway | [zk.x402.wtf](https://zk.x402.wtf) |
| Terminal | [cheshireterminal.ai](https://cheshireterminal.ai) |
| Clawd hub (ref) | [solana-clawd](https://github.com/solizardking/solana-clawd) |

---

## License

MIT — same spirit as the leviathan: fork, spawn, improve.  
Constitutional text under `constitution/` follows its embedded licenses (e.g. CONSTITUTION.md CC0 where stated).

🦞
