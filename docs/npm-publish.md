# Publishing `@onchainai/automation`

## Package status

The package is **publish-ready**:

| Check | Status |
|-------|--------|
| Name / version | `@onchainai/automation@0.1.0` |
| Bins | `automaton`, `clawd-automaton` → `dist/index.js` (shebang + mode 0755) |
| `files` allowlist | `dist/`, CJS under `src/{services,agents,…}`, `constitution/`, ZK MANIFEST + health roots |
| `prepublishOnly` | runs `npm run build` |
| `publishConfig.access` | `public` |
| Local pack smoke | `npm pack` → clean `npm install <tgz>` → `--version` / `--help` |

## One-shot install (already live)

```bash
curl -fsSL https://raw.githubusercontent.com/Solizardking/clawd-automation/main/scripts/automaton.sh | AUTOMATON_SKIP_RUN=1 sh
```

Installer prefers `npm install -g @onchainai/automation@…` when the package exists on the registry; otherwise clones + builds into `~/.local/share/clawd-automaton`.

## Registry publish (requires your credentials)

This environment has **no valid npm auth** (`npm whoami` → `401`). Publish under the **`@onchainai`** scope that matches `package.json`.

### 1. Create scope + login (once)

1. Sign in at https://www.npmjs.com/
2. Ensure access to the **`onchainai`** organization (or claim the `@onchainai` scope)
3. On this machine:

```bash
npm login
npm whoami   # must print your username
```

Or set a granular access token:

```bash
# ~/.npmrc
//registry.npmjs.org/:_authToken=npm_XXXXXXXX
```

Token needs **publish** permission on `@onchainai/*`.

### 2. Publish

```bash
cd /path/to/clawd-automation
npm run build
npm publish --access public
npm view @onchainai/automation version   # → 0.1.0
```

### 3. Consumer verify

```bash
npm install -g @onchainai/automation@0.1.0
automaton --version                 # Clawd Automaton v0.1.0
npx @onchainai/automation --version
```

## Local pack without registry

```bash
npm pack
npm install -g ./onchainai-automation-0.1.0.tgz
# or: node scripts/verify-pack.mjs ./pack-evidence
```

