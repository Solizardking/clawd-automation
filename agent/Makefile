# OpenClawd Solana Kit — setup and iteration shortcuts
#
# Fast path:
#   make setup      # copy .env, generate a keypair, check the build
#   make example    # run the simple portfolio-checker example
#   make loop       # run the full solana agent (reasoning loop) example
#   make serve      # run the HTTP service (kit binary, feature=full)
#
# All targets operate from the agent/ directory.

SHELL := /bin/bash
CARGO ?= cargo

# Default feature set (Solana library only).
FEATURES ?=

# Feature set for the HTTP service / kit binary.
FULL_FEATURES ?= full

ENV_FILE := .env

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.PHONY: setup
setup: env keypair wire-key check ## One-command first-run setup

.PHONY: env
env: ## Create .env from .env.example (never overwrites an existing .env)
	@if [ -f "$(ENV_FILE)" ]; then \
		echo "✓ $(ENV_FILE) already exists — leaving it untouched"; \
	else \
		cp .env.example "$(ENV_FILE)" && echo "✓ Created $(ENV_FILE) — fill in ANTHROPIC_API_KEY and SOLANA_PRIVATE_KEY"; \
	fi

.PHONY: keypair
keypair: ## Generate a fresh Solana keypair (skips if keypair.json exists)
	@if [ -f keypair.json ]; then \
		echo "✓ keypair.json already exists"; \
	else \
		if command -v solana-keygen >/dev/null 2>&1; then \
			solana-keygen new --no-bip39-passphrase --outfile keypair.json --force \
				&& echo "✓ Generated keypair.json (dev only — never commit this file)"; \
		else \
			echo "! solana-keygen not found — install the Solana CLI, or set SOLANA_PRIVATE_KEY manually in .env"; \
		fi; \
	fi

.PHONY: wire-key
wire-key: ## Fill SOLANA_PRIVATE_KEY in .env from keypair.json (idempotent)
	@if [ -f keypair.json ] && [ -f scripts/keypair_to_env.sh ]; then \
		bash scripts/keypair_to_env.sh; \
	elif [ ! -f keypair.json ]; then \
		echo "→ No keypair.json — set SOLANA_PRIVATE_KEY manually in .env"; \
	fi

.PHONY: check
check: ## Compile-check the default (solana) feature set
	$(CARGO) check

.PHONY: check-full
check-full: ## Compile-check everything (solana + evm + http + cross-chain)
	$(CARGO) check --features full

.PHONY: build
build: ## Build the default feature set
	$(CARGO) build

.PHONY: build-full
build-full: ## Build with all features
	$(CARGO) build --features $(FULL_FEATURES)

.PHONY: test
test: ## Run unit tests (default features)
	$(CARGO) test

.PHONY: test-full
test-full: ## Run unit tests with all features
	$(CARGO) test --features $(FULL_FEATURES)

.PHONY: simple
simple: ## Run the simple portfolio-checker example (needs .env values)
	$(CARGO) run --example simple

.PHONY: loop
loop: ## Run the full Solana reasoning-loop example (needs .env values)
	$(CARGO) run --example solana_agent

.PHONY: example
example: simple ## Alias for the simplest demo

.PHONY: serve
serve: ## Run the HTTP service on 0.0.0.0:6969 (needs Privy env vars)
	$(CARGO) run --features $(FULL_FEATURES) --bin kit

.PHONY: clean
clean: ## Clean build artifacts
	$(CARGO) clean

.PHONY: docs
docs: ## Serve the mdBook docs locally (installs mdbook if missing)
	@if ! command -v mdbook >/dev/null 2>&1; then \
		echo "Installing mdbook..."; \
		$(CARGO) install mdbook; \
	fi
	@cd docs && mdbook serve --open