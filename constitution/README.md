# Clawd Constitution Bundle

Canonical agent harness documents for the Conway Automaton / X402Agent runtime.
Loaded at runtime from this directory by `src/services/constitution.js`.

| File | Role | Authority |
|------|------|-----------|
| `three-laws.md` | Immutable on-chain execution laws I–III | 1 (highest) |
| `six-laws.md` | Full six-law harness (I–VI) | 2 |
| `CONSTITUTION.md` | Highest interpretive authority | 2 |
| `CLAWD.md` | Spawn harness context | 3 |
| `IDENTITY.md` | Sovereign identity document | 3 |
| `SOUL.md` | Character, philosophy, trading spirit | 4 |
| `program.md` | Research-loop program | 5 |
| `strategy.md` | Active strategy parameters | 5 |

**Authority order:** on-chain laws (`three-laws.md`) > `CONSTITUTION.md` / `six-laws.md` > creator shell > user > trench.

**Principals:** Constitution > Creator > User > Trench.

Ecosystem: [x402.wtf](https://x402.wtf) · [zk.x402.wtf](https://zk.x402.wtf) · [cheshireterminal.ai](https://cheshireterminal.ai)

## Runtime load

```js
// CJS (primary interop path)
const constitution = require('../src/services/constitution');
constitution.getManifest();
constitution.getPromptContext({ maxChars: 6000 });
constitution.attestOnChainLaws();

// Via automaton tool
// cjs_capability name=constitution method=getManifest
// constitution_context
```
