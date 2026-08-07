#!/bin/sh
# Publish @onchainai/automation (requires npm whoami + 2FA OTP).
# Usage:
#   NPM_OTP=123456 ./scripts/npm-publish.sh
#   ./scripts/npm-publish.sh 123456
set -eu
cd "$(dirname "$0")/.."
OTP="${1:-${NPM_OTP:-}}"
if [ -z "$OTP" ]; then
  echo "Usage: NPM_OTP=<code> $0   OR   $0 <otp>"
  echo "Get a code from your authenticator (npm 2FA), or complete web auth after npm prompts."
  exit 2
fi
npm whoami >/dev/null
npm run build
npm test
npm publish --access public --otp="$OTP"
npm view @onchainai/automation version
npm view @onchainai/automation dist-tags
echo "Live: https://www.npmjs.com/package/@onchainai/automation"
