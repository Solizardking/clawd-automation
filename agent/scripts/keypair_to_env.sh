#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Wire keypair.json into agent/.env as SOLANA_PRIVATE_KEY (base58, 64 bytes).
#
# Used by `make setup` after generating a fresh dev keypair with solana-keygen.
# Idempotent: only fills the empty SOLANA_PRIVATE_KEY= placeholder; never
# overwrites an existing value.
#
# Requires: python3 (for JSON → base58 conversion, no pip dependencies).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env"
KEYPAIR_FILE="keypair.json"

if [[ ! -f "$KEYPAIR_FILE" ]]; then
  echo "! $KEYPAIR_FILE not found — run 'make keypair' first." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "! python3 is required to convert keypair.json to base58." >&2
  echo "  Set SOLANA_PRIVATE_KEY manually in $ENV_FILE instead." >&2
  exit 1
fi

# Convert the 64-byte keypair array (private ‖ public) to base58 (bs58 alphabet).
BASE58_KEY="$(python3 - "$KEYPAIR_FILE" <<'PY'
import json, sys

with open(sys.argv[1]) as f:
    key = bytes(json.load(f))

alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

n = int.from_bytes(key, "big")
if n == 0:
    print("1" * len(key))
else:
    encoded = ""
    while n:
        n, rem = divmod(n, 58)
        encoded = alphabet[rem] + encoded
    zeros = len(key) - len(key.lstrip(b"\x00"))
    print("1" * zeros + encoded)
PY
)"

if grep -q "^SOLANA_PRIVATE_KEY=$" "$ENV_FILE"; then
  python3 - "$ENV_FILE" "$BASE58_KEY" <<'PY'
import sys

path, key = sys.argv[1], sys.argv[2]

with open(path) as f:
    lines = f.readlines()

changed = False
with open(path, "w") as f:
    for line in lines:
        if line.startswith("SOLANA_PRIVATE_KEY=") and line.strip().endswith("="):
            f.write(f"SOLANA_PRIVATE_KEY={key}\n")
            changed = True
        else:
            f.write(line)

sys.exit(0 if changed else 2)
PY
  echo "✓ Wrote SOLANA_PRIVATE_KEY into $ENV_FILE (from $KEYPAIR_FILE)"
else
  echo "→ SOLANA_PRIVATE_KEY already set in $ENV_FILE — leaving as-is"
fi