# Introduction

**OpenClawd SVM Kit** is a Rust toolkit for building agents that operate inside
the Solana Virtual Machine. It packages Solana transaction helpers,
wallet-scoped signing, Phoenix/Rise perps context, and `rig-core` tools into a
small crate that can power local command-line agents or an HTTP service used by
OpenClawd frontends.

The default build is SVM-first:

- `solana` is enabled by default
- `full` means `solana + http`
- `http` adds the SSE service and Privy delegated signing

## Core Pieces

- **SVM tools** for Jupiter swaps, SOL/SPL transfers, balances, portfolio
  lookup, token prices, Pump.fun flows, and DexScreener search.
- **Phoenix/Rise perps context** for paper-first market checks, open-interest
  signals, preflight gates, and eventually explicitly approved live orders.
- **SignerContext** for per-request signer isolation. Tool calls only see the
  signer bound to the current async scope.
- **Agent builders** that attach the SVM tools to a `rig-core` Anthropic
  agent.
- **HTTP service** with Server-Sent Events streaming for web or TUI clients.

## Design Goals

- Keep SVM execution as the normal path.
- Require explicit signer context for every transaction.
- Make read-only market and portfolio calls easy to expose to an agent.
- Keep production signing separate from local private-key development.
- Keep perps paper-first, with live execution behind explicit approval.
- Ship Clawd constitution (Laws I–III) on every default agent preamble.

## Clawd Constitution

Agent preambles load from the monorepo `constitution/` bundle (shared with the
TypeScript automaton under `dist/`):

| File | Role |
|------|------|
| `three-laws.md` | Immutable on-chain laws I–III (preferred load) |
| `six-laws.md` | Full harness I–VI |
| `CONSTITUTION.md` | Interpretive authority |
| `IDENTITY.md` / `SOUL.md` | Identity + character |
| `program.md` / `strategy.md` | Research loop + active strategy |

Rust: `openclawd_solana_kit::constitution::clawd_system_preamble()`.  
TypeScript/`dist`: `src/services/constitution.js` via CJS interop health.
