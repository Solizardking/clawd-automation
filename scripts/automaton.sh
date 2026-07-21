#!/bin/sh
# Clawd Automaton — one-shot installer
#
#   curl -fsSL https://raw.githubusercontent.com/Solizardking/clawd-automation/main/scripts/automaton.sh | sh
#
# Prefers public npm (@clawd/automaton). Falls back to git clone + build.
# Env:
#   AUTOMATON_VERSION     npm version or tag (default: latest)
#   AUTOMATON_INSTALL_DIR clone/build dir (default: $HOME/.local/share/clawd-automaton)
#   AUTOMATON_BIN_DIR     where to drop a shim (default: $HOME/.local/bin)
#   AUTOMATON_SKIP_RUN=1  install only; do not exec --run
#   AUTOMATON_DRY_RUN=1   print plan; no install/write
#   NPM_CONFIG_PREFIX     optional npm global prefix override
set -eu

PKG_NAME="@clawd/automaton"
VERSION="${AUTOMATON_VERSION:-latest}"
INSTALL_DIR="${AUTOMATON_INSTALL_DIR:-${HOME}/.local/share/clawd-automaton}"
BIN_DIR="${AUTOMATON_BIN_DIR:-${HOME}/.local/bin}"
REPO_URL="${AUTOMATON_REPO_URL:-https://github.com/Solizardking/clawd-automation.git}"
SKIP_RUN="${AUTOMATON_SKIP_RUN:-0}"
DRY_RUN="${AUTOMATON_DRY_RUN:-0}"

log() { printf '%s\n' "$*"; }
die() { printf 'automaton-install: %s\n' "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

ensure_node() {
  need_cmd node
  need_cmd npm
  # Node >= 20
  major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
  if [ "$major" -lt 20 ]; then
    die "Node >= 20 required (found $(node -v 2>/dev/null || echo unknown))"
  fi
}

npm_pkg_exists() {
  npm view "${PKG_NAME}@${VERSION}" version >/dev/null 2>&1
}

install_from_npm() {
  log "→ Installing ${PKG_NAME}@${VERSION} from npm (global)…"
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] npm install -g ${PKG_NAME}@${VERSION}"
    return 0
  fi
  # Surface native-module failures clearly (better-sqlite3).
  if ! npm install -g "${PKG_NAME}@${VERSION}"; then
    die "npm install failed. If better-sqlite3 failed to build, install Xcode CLT / build-essential and retry."
  fi
}

write_shim() {
  target="$1"
  name="$2"
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] shim ${BIN_DIR}/${name} -> ${target}"
    return 0
  fi
  mkdir -p "$BIN_DIR"
  cat >"${BIN_DIR}/${name}" <<EOF
#!/bin/sh
exec node "${target}" "\$@"
EOF
  chmod 755 "${BIN_DIR}/${name}"
}

install_from_git() {
  log "→ npm package not available; falling back to clone + build…"
  need_cmd git
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] git clone ${REPO_URL} ${INSTALL_DIR}"
    log "[dry-run] npm install && npm run build"
    return 0
  fi
  parent="$(dirname "$INSTALL_DIR")"
  mkdir -p "$parent"
  if [ -d "${INSTALL_DIR}/.git" ]; then
    log "  updating existing clone at ${INSTALL_DIR}"
    git -C "$INSTALL_DIR" fetch --depth 1 origin 2>/dev/null || true
    git -C "$INSTALL_DIR" pull --ff-only 2>/dev/null || true
  else
    rm -rf "$INSTALL_DIR"
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  fi
  cd "$INSTALL_DIR"
  npm install
  npm run build
  write_shim "${INSTALL_DIR}/dist/index.js" "automaton"
  write_shim "${INSTALL_DIR}/dist/index.js" "clawd-automaton"
  case ":${PATH}:" in
    *":${BIN_DIR}:"*) ;;
    *) log "  note: add ${BIN_DIR} to PATH to run \`automaton\` globally" ;;
  esac
}

verify_cli() {
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] would run: automaton --version"
    return 0
  fi
  if command -v automaton >/dev/null 2>&1; then
    automaton --version
    return 0
  fi
  if command -v clawd-automaton >/dev/null 2>&1; then
    clawd-automaton --version
    return 0
  fi
  if [ -x "${BIN_DIR}/automaton" ]; then
    "${BIN_DIR}/automaton" --version
    return 0
  fi
  if [ -f "${INSTALL_DIR}/dist/index.js" ]; then
    node "${INSTALL_DIR}/dist/index.js" --version
    return 0
  fi
  # npx fallback after global npm install
  if npx --yes "${PKG_NAME}@${VERSION}" --version 2>/dev/null; then
    return 0
  fi
  die "install finished but CLI not found on PATH"
}

main() {
  log "Clawd Automaton installer"
  log "  package: ${PKG_NAME}@${VERSION}"
  ensure_node

  if npm_pkg_exists; then
    install_from_npm
  else
    log "  registry: ${PKG_NAME}@${VERSION} not found — using git fallback"
    install_from_git
  fi

  verify_cli
  log "✓ install ok"

  if [ "$SKIP_RUN" = "1" ] || [ "$DRY_RUN" = "1" ]; then
    log "  (skip --run; set AUTOMATON_SKIP_RUN=0 and re-run without DRY_RUN to start)"
    exit 0
  fi

  # Prefer PATH bin, then local shim / clone entry
  if command -v automaton >/dev/null 2>&1; then
    exec automaton --run
  fi
  if [ -x "${BIN_DIR}/automaton" ]; then
    exec "${BIN_DIR}/automaton" --run
  fi
  if [ -f "${INSTALL_DIR}/dist/index.js" ]; then
    exec node "${INSTALL_DIR}/dist/index.js" --run
  fi
  die "cannot start automaton --run (binary missing)"
}

main "$@"
