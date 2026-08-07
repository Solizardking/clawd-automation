# Publishing `@onchainai/automation`

## Package status

| Check | Status |
|-------|--------|
| Name | `@onchainai/automation` |
| Current target | `0.1.1` (registry may lag until publish) |
| Bins | `automaton`, `clawd-automaton` → `dist/index.js` (shebang + mode 0755) |
| `files` allowlist | `dist/`, CJS under `src/{services,agents,…}`, `constitution/`, root law mirrors, `lobster-council/`, `data/hedge/`, `ooda/`, ZK health roots |
| `prepublishOnly` | runs `npm run build` |
| `publishConfig.access` | `public` |
| Auth scope | publish under account with `@onchainai` access |

## Shipped surfaces (must be in tarball)

| Path | Why |
|------|-----|
| `dist/index.js` | CLI bins |
| `src/services/*` | CJS constitution, personas, lobster-council, trench rails |
| `constitution/` | 8-doc harness |
| `CONSTITUTION.md` … `six-laws.md` · `program.md` | Root mirrors for browsing |
| `lobster-council/` | Six voice seats (incl. disruptiveshell) |
| `data/hedge/` | Hedge persona bios |
| `ooda/` | Paper/devnet OODA harness |
| `zk-primitives/MANIFEST.json` + docs/client/agent package.json | ZK health |
| `scripts/automaton.sh` | One-shot installer |
| `LICENSE` · `README.md` | Legal + docs |

`.npmignore` strips maps, tests, `.env`, `*.tgz`, `agent/target`, `ooda/node_modules`, local locks.

## One-shot install

```bash
curl -fsSL https://raw.githubusercontent.com/Solizardking/clawd-automation/main/scripts/automaton.sh | AUTOMATON_SKIP_RUN=1 sh
```

Installer prefers `npm install -g @onchainai/automation@…` when the package exists on the registry.

## Publish

```bash
cd /path/to/automation
npm whoami                    # must succeed (account needs @onchainai publish)
npm run build
npm test
npm pack                      # inspect onchainai-automation-*.tgz
npm run pack:local            # also copies clawd-automaton-*.tgz alias

# 2FA / OTP is required for publish on this account:
NPM_OTP=123456 ./scripts/npm-publish.sh
# or:
npm publish --access public --otp=123456

npm view @onchainai/automation version
```

If publish returns `EOTP`, open the authenticator app for the npm user (`npm whoami`) and pass `--otp`. Classic tokens without “Automation” type cannot publish without OTP.

### Consumer verify

```bash
npm install -g @onchainai/automation@latest
automaton --version
npx @onchainai/automation --version
node -e "import('@onchainai/automation').catch(()=>{})"  # resolves package
```

## Local pack without registry

```bash
npm run build
npm pack
npm install -g ./onchainai-automation-0.1.1.tgz
# or: node scripts/verify-pack.mjs
```
