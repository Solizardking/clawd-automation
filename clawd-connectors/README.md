# 🦞 Clawd Connectors

**MCP-powered provider connectors for ClawdCode** — DFlow, Helius, Jupiter, and Birdeye.

> **Set your API keys:** `DFLOW_API_KEY`, `HELIUS_API_KEY`, `JUPITER_API_KEY`, `BIRDEYE_API_KEY`

## Features

- **Remote MCP connectors** — each provider connects to a remote MCP server URL (e.g. `https://api.paybox.sh/mcp?app=dflow`), so any MCP-compatible client (Claude Code, Claude Desktop, Cursor) can call the provider tools directly
- **API key aware** — reads `DFLOW_API_KEY`, `HELIUS_API_KEY`, `JUPITER_API_KEY`, `BIRDEYE_API_KEY`
- **REST fallback** — providers with HTTP APIs also expose typed convenience methods (`helius.rpc`, `jupiter.quote`)
- **`.mcp.json` included** — drop-in connector registration for Claude Code

## Quickstart (Claude Code connectors)

Add a remote connector in Claude Code's connector settings, or add this package's `.mcp.json`:

```bash
claude mcp add dflow -- url "https://api.paybox.sh/mcp?app=dflow"
```

Or check in this repo's `.mcp.json`:

```json
{
  "mcpServers": {
    "DFlow":     { "type": "http", "url": "https://api.paybox.sh/mcp?app=dflow" },
    "Helius":    { "type": "http", "url": "https://api.helius.dev/mcp" },
    "Jupiter":   { "type": "http", "url": "https://api.jup.ag/mcp" },
    "Birdeye":   { "type": "http", "url": "https://public-api.birdeye.so/mcp" }
  }
}
```

## CLI

```bash
npm install
npm run build

clawd-connectors status          # show API keys status + MCP URLs for all providers
clawd-connectors list-tools dflow # list MCP tools exposed by the DFlow remote server
```

## Library usage

```ts
import { createConnectors } from "@openclawd/clawd-connectors";

const connectors = createConnectors(); // reads env: DFLOW_API_KEY, HELIUS_API_KEY, ...

// Call a tool on the DFlow remote MCP server
const res = await connectors.dflow.callTool("open_position", { size: 10 });

// List tools exposed by the Birdeye remote MCP server
const tools = await connectors.birdeye.listTools();

// Helius RPC convenience (REST fallback)
const balance = await connectors.helius.rpc("getBalance", ["somePubkey"]);
```

## Providers

| Provider | API Key | MCP URL | REST fallback |
|----------|---------|---------|---------------|
| **DFlow** | `DFLOW_API_KEY` | `https://api.paybox.sh/mcp?app=dflow` | `https://api.dflow.net` |
| **Helius** | `HELIUS_API_KEY` | `https://api.helius.dev/mcp` | `https://api.helius.dev` |
| **Jupiter** | `JUPITER_API_KEY` | `https://api.jup.ag/mcp` | `https://quote-api.jup.ag` |
| **Birdeye** | `BIRDEYE_API_KEY` | `https://public-api.birdeye.so/mcp` | `https://public-api.birdeye.so` |

## Development

```bash
npm install
npm run build
npm test
```
