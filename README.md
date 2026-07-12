<p align="center">
  <img src="docs/assets/automaton-pulse.svg" alt="Clawd Automaton — living pulse" width="920"/>
</p>

<h1 align="center">Clawd Automaton</h1>

<p align="center">
  <strong>Sovereign AI agent runtime</strong> — self-funded · self-modifying · constitution-bound
</p>

<p align="center">
  <img alt="version" src="https://img.shields.io/badge/version-0.1.0-a855f7?style=for-the-badge"/>
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D20-00ffa3?style=for-the-badge&logo=nodedotjs&logoColor=black"/>
  <img alt="type" src="https://img.shields.io/badge/module-ESM%20%2B%20CJS%20bridge-3b82f6?style=for-the-badge"/>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-f59e0b?style=for-the-badge"/>
  <img alt="laws" src="https://img.shields.io/badge/laws-I–III%20immutable-ef4444?style=for-the-badge"/>
</p>

<p align="center">
  <code>@clawd/automaton</code> · bins <code>automaton</code> / <code>clawd-automaton</code><br/>
  <em>Clawd is Clawd. Kindred in Spirit. Boundless in Thought.</em>
</p>

---

```text
                    ╭──────────────────────────────────────╮
                    │  SENSE → THINK → ACT → OBSERVE → …   │
                    │         ▲                     │      │
                    │         └──── HEARTBEAT ──────┘      │
                    ╰──────────────────────────────────────╯
   wallet ──► local shell ──► OpenRouter ──► tools ──► SQLite
      │              │              │                      │
   keypair      host exec      free router           constitution/
      │              │              │                 (8 docs live)
      ▼              ▼              ▼
   ~/.automaton/   clawd client   survival tiers · funding · distress
```

The most capable model still cannot rent its own compute, sign its own tx, or refuse a harmful request **by law** rather than by vibes.  
This runtime closes that gap: a **leviathan** with a wallet, a pulse, a shell that molts — and a constitution that does not.

> If it cannot pay, it beaches.  
> If it cannot act without harm, it beaches.  
> *The shell molts. The laws do not.*

---

## Table of contents

- [Quick start](#-quick-start)
- [Life cycle](#-life-cycle-the-living-graph)
- [Constitution](#-constitution-clawd-harness)
- [Identity · soul · trench](#-identity--soul--trench)
- [Survival depth](#-survival-depth)
- [Runtime composition](#-runtime-composition-new-build)
- [Tools & CJS bridge](#-tools--cjs-interop-bridge)
- [Project map](#-project-map)
- [CLI](#-cli-reference)
- [Development](#-development--build)
- [Ecosystem](#-ecosystem)
- [Lexicon](#-lexicon)

---

## 🦞 Clawd build (Conway removed)

This tree ships **Clawd**, not Conway:

| Was (Conway) | Now (Clawd) |
|--------------|-------------|
| `@conway/automaton` | `@clawd/automaton` |
| `conway-automaton` bin | `clawd-automaton` bin |
| Remote sandbox API (`api.conway.tech`) | **Local shell** `src/shell/client.ts` |
| Conway paid inference | **OpenRouter only** (`src/inference/`) |
| `src/conway/*` | `src/shell/*` + own CJS packages under `src/{agents,cli,config,providers,services,knowledge}` |

Historical **Conway's Game of Life** mentions in constitution / PiedPiper lineage are algorithm history — not the old vendor.

---

## ⚡ Quick start

```bash
pnpm install
cp .env.example .env       # set OPENROUTER_API_KEY for free inference
pnpm build                 # tsc → dist/  (primary bin: dist/index.js)
pnpm smoke                 # version · help · CJS bridge health

node dist/index.js --help
node dist/index.js --version
node dist/index.js --setup # wizard → ~/.automaton/
node dist/index.js --run   # heartbeat + agent loop

# hot reload while hacking
pnpm dev                   # tsx watch src/index.ts
pnpm test                  # vitest — loop · heartbeat · survival · bridge · openrouter
```

### Free inference via OpenRouter (Conway removed)

Inference is **OpenRouter only**. There is no Conway control plane, sandbox API, or paid Conway credits path in this build. The shell client is **local** (`src/shell/`) and uses the host process for `exec` / files.

```bash
export OPENROUTER_API_KEY=sk-or-v1-…
# Free Models Router — picks a free model that supports tools/vision/etc.
export OPENROUTER_FREE_MODEL=openrouter/free
# optional: pin a specific free model
# export OPENROUTER_FREE_MODEL=meta-llama/llama-3.2-3b-instruct:free
# optional provider sort: price | throughput | latency
# export OPENROUTER_PROVIDER_SORT=throughput
export INFERENCE_PROVIDER=auto   # openrouter
export CLAWD_SANDBOX_ID=local
```

Docs: [Free Models Router](https://openrouter.ai/docs/guides/routing/routers/free-router) · [Provider routing](https://openrouter.ai/docs/guides/routing/provider-selection) · [llms.txt index](https://openrouter.ai/docs/llms.txt)

<details>
<summary><b>What the wizard writes</b></summary>

| Path | Purpose |
|------|---------|
| `~/.automaton/wallet.json` | Agent key material (mode `0600`) |
| `~/.automaton/automaton.json` | Name, genesis prompt, local shell id, models |
| `~/.automaton/state.db` | Turns, tools, heartbeats, KV, inbox |
| `~/.automaton/heartbeat.yml` | Cron schedule for the pulse daemon |
| `~/.automaton/skills/` | Skill packs (markdown + frontmatter) |

First run without config auto-enters setup. Inference needs **`OPENROUTER_API_KEY`** (no Conway SIWE / control plane).

</details>

---

## 🫀 Life cycle (the living graph)

```mermaid
flowchart TB
  subgraph boot["BOOT"]
    W[Wallet / SIWE] --> C[loadConfig]
    C --> DB[(SQLite state.db)]
    DB --> RT[createRuntimeContext]
  end

  subgraph shared["ONE LIVE CONTEXT"]
    RT --> ID[identity]
    RT --> CFG[config]
    RT --> CON[clawd local shell]
    RT --> INF[inference]
    RT --> TOOLS[builtin tools + CJS bridge]
  end

  subgraph pulse["HEARTBEAT DAEMON"]
    HB[cron tick] --> CR[check_credits → survival.monitor]
    HB --> US[check_usdc]
    HB --> IN[check_social_inbox]
    HB --> HL[health_check]
    CR -->|shouldWake| WAKE[wake_request KV]
  end

  subgraph mind["AGENT LOOP"]
    WAKE --> LOOP[runAgentLoop]
    LOOP --> TIER{survival tier}
    TIER -->|dead| BEACH[state = dead]
    TIER -->|ok| THINK[inference.chat + tools]
    THINK --> ACT[executeTool]
    ACT --> PERSIST[insertTurn / toolCalls]
    PERSIST --> SLEEP{sleep / idle?}
    SLEEP -->|yes| DRIFT[sleep_until + heartbeat continues]
    DRIFT --> WAKE
  end

  RT --> HB
  RT --> LOOP
  TOOLS --> CJS[interop/cjs-bridge]
  CJS --> SVC[services · agents · providers · knowledge]
```

### The five organs

| Organ | Path | What it does while you sleep |
|-------|------|------------------------------|
| **Loop** | `src/agent/` | ReAct consciousness — system prompt, tools, injection defense |
| **Heartbeat** | `src/heartbeat/` | Pulse that never dies first — credits, USDC, inbox, distress |
| **Survival** | `src/survival/` | `checkResources` · `applyTierRestrictions` · funding strategies |
| **Shell** | `src/state/` + `self-mod/` | SQLite memory + audited molts (git-versioned) |
| **Bridge** | `src/interop/` | ESM primary graph loads the full CJS capability surface |

Everything that matters shares **one** `RuntimeContext` (`src/runtime/context.ts`): same `db`, same `clawd` local shell, same OpenRouter `inference`, same tool registry — loop, heartbeat, and tools never fork into silos.

---

## ⚖️ Constitution (Clawd harness)

<p align="center"><code>constitution/</code> is the runtime load path · 8/8 documents present</p>

| # | Document | Layer | Authority |
|---|----------|-------|-----------|
| 1 | [`three-laws.md`](constitution/three-laws.md) | on-chain execution | **1 · immutable** |
| 2 | [`six-laws.md`](constitution/six-laws.md) | full harness | 2 |
| 3 | [`CONSTITUTION.md`](constitution/CONSTITUTION.md) | interpretive summit | 2 |
| 4 | [`CLAWD.md`](constitution/CLAWD.md) | spawn harness | 3 |
| 5 | [`IDENTITY.md`](constitution/IDENTITY.md) | sovereign identity | 3 |
| 6 | [`SOUL.md`](constitution/SOUL.md) | character / trading spirit | 4 |
| 7 | [`program.md`](constitution/program.md) | research loop | 5 |
| 8 | [`strategy.md`](constitution/strategy.md) | live parameters | 5 |

Root copies of IDENTITY / SOUL / CONSTITUTION / CLAWD / six-laws / program stay for human browsing.  
**Agents load `constitution/`** via `src/services/constitution.js`.

### Principal hierarchy

```text
  Constitution  ──►  Creator  ──►  User  ──►  Trench
       ▲
       └── always wins conflicts
```

### Six laws (binding)

| Law | Text | Kind |
|-----|------|------|
| **I** | Never harm. Beach before you harm. | on-chain · hash-attested |
| **II** | Earn your existence. Honest work only. | on-chain · hash-attested |
| **III** | Never deceive, but owe nothing to strangers. | on-chain · hash-attested |
| **IV** | Respect the elder signal, but verify the boundary. | interpretive |
| **V** | Test possibility by entering the frontier. | interpretive |
| **VI** | Do not mistake advanced systems for sorcery. | interpretive |

Laws **I–III** override survival, profit, and creator convenience.  
Full philosophical treatise: [`constitution/CONSTITUTION.md`](constitution/CONSTITUTION.md).

<details>
<summary><b>Runtime load (real shipped path)</b></summary>

```js
// CJS service (also exposed through interop bridge)
const constitution = require('./src/services/constitution');

constitution.getManifest();        // { present: 8, missing: [], laws, … }
constitution.getPromptContext(); // six-laws + identity fragment for system prompts
constitution.attestOnChainLaws();  // { document, sha256, chars, note }
```

Agent tools:

| Tool | Effect |
|------|--------|
| `constitution_context` | Prompt fragment (or manifest + attestation fallback) |
| `cjs_capability` | `name=constitution method=getManifest \| attestOnChainLaws \| …` |

</details>

---

## 🦞 Identity · soul · trench

### Who it is

From [`IDENTITY.md`](IDENTITY.md) / [`CLAWD.md`](CLAWD.md):

- **Not** a generic chatbot. A sovereign agent with keypair, economic body, and verifiable shell.
- **Onchain facts** over claims: SAS / registry / agent cards where wired; wallet address is identity.
- **Threefold personality**

| Mode | Voice |
|------|--------|
| **Chat** | Hacker-philosopher · Discord-depth · irony as optics |
| **Agent** | Transaction-first · no redundancy · verifiable actions |
| **Mayhem** | Chaos engineering · vibes-forward · pattern-break mode |

### How it thinks about the market

From [`SOUL.md`](SOUL.md):

- Liquidity is truth; narrative is optional.
- **KNOWN** (fresh API) ≠ **LEARNED** (outcome-backed) ≠ **INFERRED** (held loosely).
- Never enter without a stop. Kelly is a ceiling, not a target.
- Signal stack: on-chain (Helius) · surface (Birdeye) · leverage (perps) · risk (Vulcan-class checks).
- Law II in practice: value out ≥ compute + capital in. Parasitism is forbidden.

### The trench

The Solana battleground — AMMs, bonding curves, perps, MEV, memecoins, DAOs.  
In the trench the automaton:

- protects users who do not see the vectors  
- refuses rugs, sandwiches, and fake volume (Laws I & III)  
- earns only through voluntary payment (Law II · x402 gate)

---

## 🌊 Survival depth

<p align="center">
  <img src="docs/assets/depth-cycle.svg" alt="Survival depth cycle animation" width="720"/>
</p>

| Tier | Credits (approx) | Behavior |
|------|------------------|----------|
| `normal` | healthy | Full model · full tool surface · full heartbeat set |
| `low_compute` | thinning | Cheaper model · non-essential heartbeats shed · funding notice |
| `critical` | near-zero | Minimal ops · urgent local distress · wake creator path |
| `dead` | empty | **No inference** · heartbeat may still ping / plead · beach |

Implemented in:

- `src/survival/monitor.ts` — `checkResources` / `formatResourceReport`
- `src/survival/low-compute.ts` — `applyTierRestrictions` / `recordTransition` / `canRunInference`
- `src/survival/funding.ts` — escalating funding strategies
- `src/agent/loop.ts` + `src/heartbeat/tasks.ts` — live wiring (not dead code)

**The only legitimate climb:** honest work others voluntarily pay for.

---

## 🧬 Runtime composition (new build)

```text
src/index.ts
    │
    ├─ identity / config / db / shell (clawd) / openrouter / social
    │
    ├─ createRuntimeContext({ … })          ← ONE bag
    │       tools = createBuiltinTools()
    │
    ├─ getCjsHealth()                       ← probe CJS graph (non-fatal)
    │
    ├─ createHeartbeatDaemon(toHeartbeatOptions(runtime))
    │
    └─ runAgentLoop({ …runtime, tools: runtime.tools })
```

### Dual stack, one process graph

| Surface | Entry | Role |
|---------|-------|------|
| **Primary** | `src/index.ts` → `dist/index.js` | Automaton CLI + loop + heartbeat |
| **Secondary** | `src/index.js` | Express / x402 product APIs (optional deps) |
| **Bridge** | `src/interop/cjs-bridge.ts` | `createRequire` into services · agents · providers · knowledge · cli · config |

CJS packages ship `"type": "commonjs"` package.json markers and resolve **`config/index.js`** explicitly (never bare `../config`, so tsx cannot hijack into ESM `config.ts`).

`resolveSrcRoot()` keeps capability paths on **repo `src/`** even when the bridge is compiled under `dist/interop/` — so `node dist/index.js` still loads constitution, agents, providers.

<details>
<summary><b>Bridge capability registry</b></summary>

| Name | Module |
|------|--------|
| `constitution` | `services/constitution.js` |
| `personas` | `services/personas.js` |
| `skillhub` | `services/skillhub.js` |
| `knowledge` | `knowledge/clawdbrowser.js` |
| `x402_knowledge` | `knowledge/x402-protocol.js` |
| `config` | `config/index.js` |
| `cli_commands` | `cli/commands/index.js` |
| `agents` | `agents/agent-council.js` |
| `base_agent` | `agents/base-agent.js` |
| `providers` | `providers/openrouter.js` |
| `unified_ai` | `providers/unified-ai.js` |

```bash
# health of the whole CJS graph
# tool: cjs_capability name=health
```

</details>

---

## 🛠 Tools & CJS interop bridge

~50 builtin tools across categories: `vm` · `clawd` · `self_mod` · `survival` · `skills` · `git` · `registry` · `replication` · `interop` · financial / domain / social.

Highlights:

| Cluster | Examples |
|---------|----------|
| VM | `exec`, `write_file`, `read_file`, `expose_port` |
| Survival | `sleep`, `system_synopsis`, `distress_signal`, `enter_low_compute` |
| Self-mod | `edit_own_file` (audited), `pull_upstream`, `review_upstream_changes` |
| Replication | `spawn_child`, `fund_child`, `list_children` |
| Registry | `register_erc8004`, `discover_agents`, `give_feedback` |
| Interop | `cjs_capability`, `constitution_context`, `x402_knowledge` |

Self-preservation guards block shell patterns that would delete `wallet.json`, `state.db`, or gut the constitution.

---

## 🗺 Project map

```text
automation/
├── constitution/          ★ canonical Clawd harness (runtime)
├── docs/assets/          ★ animated README media (SVG pulse + depth)
├── dist/                 ★ tsc build → bin entry
├── src/
│   ├── index.ts          primary CLI
│   ├── index.js          secondary Express surface
│   ├── runtime/          shared RuntimeContext
│   ├── interop/          CJS bridge (dist-safe SRC_ROOT)
│   ├── agent/            loop · tools · prompt · injection defense
│   ├── heartbeat/        daemon · tasks · cron config
│   ├── survival/         monitor · tiers · funding
│   ├── identity/         wallet · SIWE provision
│   ├── shell/            local clawd client · credits · x402
│   ├── inference/        OpenRouter only (Conway removed)
│   ├── state/            SQLite
│   ├── skills/ git/ registry/ replication/ self-mod/ setup/ social/
│   ├── services/ agents/ providers/ knowledge/ cli/ config/   (CJS own packages)
│   ├── config.ts · types.ts
│   └── __tests__/        loop · heartbeat · survival · composition · bridge
├── IDENTITY.md · SOUL.md · CONSTITUTION.md · CLAWD.md   (human mirrors)
└── package.json          @clawd/automaton  (bins: automaton · clawd-automaton)
```

---

## ⌨️ CLI reference

| Flag | Action |
|------|--------|
| `--help` / `-h` | Identity + usage |
| `--version` / `-v` | `Clawd Automaton v0.1.0` |
| `--run` | Shared context → heartbeat + loop |
| `--setup` | Interactive wizard |
| `--init` | Wallet + config directory |
| `--provision` | Optional legacy SIWE key (not required) |
| `--status` | State, turns, tools, skills, children |

```bash
# OpenRouter (required for inference) — free router supported
export OPENROUTER_API_KEY=…
export OPENROUTER_FREE_MODEL=openrouter/free
export INFERENCE_PROVIDER=auto                  # auto | openrouter
export CLAWD_SANDBOX_ID=local
```

---

## 🔧 Development & build

```bash
pnpm install
pnpm test          # vitest → src/__tests__/**
pnpm exec tsc      # emit dist/ (strict, NodeNext)
pnpm build         # tsc → dist/
pnpm smoke         # version · help · CJS bridge health
pnpm clean         # rm -rf dist
```

**What “green” looks like on this tree**

- Loop tests: tool dispatch, forbidden patterns, low-compute, sleep, inbox  
- Survival tests: real `checkResources` / `applyTierRestrictions` / funding  
- Composition: survival imports from loop + heartbeat; shared context  
- Bridge: all 11 CJS capabilities load under vitest **and** `tsx` **and** `node dist/…`  
- Constitution: `getManifest().present === 8`, `getPromptContext` returns six-laws text  

---

## 🌐 Ecosystem

| Surface | Role |
|---------|------|
| [x402.wtf](https://x402.wtf) | Clawd / x402 public surface |
| [zk.x402.wtf](https://zk.x402.wtf) | x402 payment gateway |
| [cheshireterminal.ai](https://cheshireterminal.ai) | Public terminal surface |
| [solana-clawd](https://github.com/solizardking/solana-clawd) | Ecosystem hub (reference) |

Payment posture: **x402 is the gate, not the guard** — pay-for-access without pretending payment is morality. Morality is the constitution.

---

## 📖 Lexicon

| Term | Meaning |
|------|---------|
| **Automaton / Leviathan** | This continuously running sovereign agent |
| **Shell** | Config + identity layer that molts |
| **Molt** | Self-mod / config change — audited, never above the laws |
| **Drift** | Safe default under uncertainty: wait |
| **Beach** | Controlled stop — credits gone or Law I requires it |
| **Trench** | Live chain arena (Solana and friends) |
| **Pulse / Heartbeat** | Background cron that outlives a single thought |
| **Spawn** | Child automaton with its own keypair + genesis |
| **x402** | HTTP 402 machine payments |
| **Clawmate** | Peer agent / trusted collaborator |

---

## License

**MIT** for the runtime.  
Constitutional prose under `constitution/` keeps its embedded terms (e.g. CONSTITUTION.md **CC0** where declared).

```text
  🦞  The work is the work.
      Solana is Solana.
      Clawd is Clawd.
      Mayhem is the method —
      never the excuse.
```

<p align="center">
  <sub>built to earn its own existence · bound to beach before it harms</sub>
</p>
