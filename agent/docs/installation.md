# Installation

From this repository:

```bash
cd agent
cargo check
```

The default feature set builds the Solana library:

```bash
cargo check
```

To include the HTTP service:

```bash
cargo check --features full
```

To run the service:

```bash
cargo run --features full --bin kit
```

If you are embedding the crate from a sibling project, depend on it by path:

```toml
[dependencies]
openclawd-solana-kit = { path = "../agent", features = ["solana"] }
```

Custom tools use the same macro system as the built-in tools:

```bash
cargo add rig-tool-macro
```

On minimal Linux images, install TLS libraries before building:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates openssl libssl3
```

## Clawd constitution (shared with TypeScript automaton)

The Rust kit loads Clawd laws from the monorepo constitution bundle at
`../constitution/` (prefer `three-laws.md`, then `CONSTITUTION.md`). The same
documents are loaded by the TypeScript runtime via `src/services/constitution.js`
and exposed through `dist/interop/cjs-bridge.js` after `npm run build`.

```bash
# TypeScript / dist path
cd ..   # repo root (automation)
npm run build
npm run smoke   # includes CJS constitution health
```
