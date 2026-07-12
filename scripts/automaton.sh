#!/bin/sh
# Clawd Automaton Installer — thin wrapper
# curl -fsSL https://raw.githubusercontent.com/Solizardking/clawd-automation/main/scripts/automaton.sh | sh
set -e
git clone https://github.com/Solizardking/clawd-automation.git /opt/automaton
cd /opt/automaton
npm install && npm run build
exec node dist/index.js --run
