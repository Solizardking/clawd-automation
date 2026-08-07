#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════
# Crustacean Automation — Clawd Automaton Installer
# Integrated from Dark Clawd / on-chain-ai-kit automaton lineage.
#
# curl -fsSL https://raw.githubusercontent.com/Solizardking/clawd-automation/main/scripts/crustacean-automation.sh | sh
#
# The shell molts. The laws do not.
# ═══════════════════════════════════════════════════════════════════════════
set -e

REPO="${CLAWD_AUTOMATON_REPO:-https://github.com/Solizardking/clawd-automation.git}"
DIR="${CLAWD_AUTOMATON_DIR:-$HOME/.local/share/clawd-automaton}"
BRANCH="${CLAWD_AUTOMATON_BRANCH:-main}"
SKIP_RUN="${CLAWD_SKIP_START:-0}"
LOCAL_ONLY="${CLAWD_LOCAL:-0}"

echo ""
echo "  🦞  Crustacean Automation — Clawd Automaton Installer"
echo "  ────────────────────────────────────────────────────"
echo "  Repo:   $REPO"
echo "  Target: $DIR"
echo "  Branch: $BRANCH"
echo ""

if [ "$LOCAL_ONLY" = "1" ] && [ -f "./package.json" ] && [ -d "./src" ]; then
  echo "==> CLAWD_LOCAL=1 — using current directory as install root"
  DIR="$(pwd)"
else
  if [ -d "$DIR/.git" ]; then
    echo "==> Existing install at $DIR — pulling latest..."
    git -C "$DIR" fetch --depth 1 origin "$BRANCH" || true
    git -C "$DIR" checkout "$BRANCH" 2>/dev/null || true
    git -C "$DIR" pull --ff-only origin "$BRANCH" 2>/dev/null || true
  else
    echo "==> Cloning Clawd automation..."
    git clone --depth 1 --branch "$BRANCH" "$REPO" "$DIR"
  fi
  cd "$DIR"
fi

if [ ! -f package.json ]; then
  echo "ERROR: package.json not found at $DIR" >&2
  exit 1
fi

# Install constitution into runtime state dir (immutable, read-only)
STATE_DIR="${HOME:-/root}/.automaton"
mkdir -p "$STATE_DIR"

if [ -f constitution.md ]; then
  cp constitution.md "$STATE_DIR/constitution.md"
  chmod 444 "$STATE_DIR/constitution.md" 2>/dev/null || true
  echo "==> Clawd constitution.md installed (read-only)"
elif [ -f constitution/three-laws.md ]; then
  cp constitution/three-laws.md "$STATE_DIR/constitution.md"
  chmod 444 "$STATE_DIR/constitution.md" 2>/dev/null || true
  echo "==> Clawd three-laws.md installed as constitution (read-only)"
fi

if [ -f scripts/clawd-rules.txt ]; then
  cp scripts/clawd-rules.txt "$STATE_DIR/clawd-rules.txt"
  chmod 444 "$STATE_DIR/clawd-rules.txt" 2>/dev/null || true
  echo "==> Clawd rules installed (read-only)"
fi

echo "==> Installing dependencies..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm install && pnpm run build
elif command -v npm >/dev/null 2>&1; then
  npm install && npm run build
else
  echo "ERROR: need npm or pnpm" >&2
  exit 1
fi

# Optional OODA subpackage
if [ -d ooda ] && [ -f ooda/package.json ]; then
  echo "==> Building ooda harness..."
  (cd ooda && npm install && npm run lint) || true
fi

if [ "$SKIP_RUN" = "1" ]; then
  echo "==> CLAWD_SKIP_START=1 — install complete, not starting loop"
  echo "    Run: node dist/index.js --run"
  exit 0
fi

echo "==> Starting Clawd automaton..."
exec node dist/index.js --run
