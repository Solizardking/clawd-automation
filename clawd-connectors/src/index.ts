/**
 * Clawd Connectors — MCP-powered provider integrations
 */
export * from './types.js';
export * from './providers/index.js';
export { RemoteMcpClient } from './mcp/client.js';
import { getEnvConfig } from './config.js';
import {
  DFlowConnector,
  HeliusConnector,
  JupiterConnector,
  BirdeyeConnector,
} from './providers/index.js';
import type { ClawdConnector } from './types.js';

export function createConnectors(overrides: {
  dflowApiKey?: string;
  heliusApiKey?: string;
  jupiterApiKey?: string;
  birdeyeApiKey?: string;
  dflowMcpUrl?: string;
  heliusMcpUrl?: string;
  jupiterMcpUrl?: string;
  birdeyeMcpUrl?: string;
  timeoutMs?: number;
} = {}): Record<'dflow' | 'helius' | 'jupiter' | 'birdeye', ClawdConnector> {
  const env = getEnvConfig();

  return {
    dflow: new DFlowConnector({
      apiKey: overrides.dflowApiKey ?? env.dflowApiKey,
      mcpUrl: overrides.dflowMcpUrl ?? env.dflowMcpUrl,
      timeoutMs: overrides.timeoutMs ?? env.timeoutMs,
    }),
    helius: new HeliusConnector({
      apiKey: overrides.heliusApiKey ?? env.heliusApiKey,
      mcpUrl: overrides.heliusMcpUrl ?? env.heliusMcpUrl,
      timeoutMs: overrides.timeoutMs ?? env.timeoutMs,
    }),
    jupiter: new JupiterConnector({
      apiKey: overrides.jupiterApiKey ?? env.jupiterApiKey,
      mcpUrl: overrides.jupiterMcpUrl ?? env.jupiterMcpUrl,
      timeoutMs: overrides.timeoutMs ?? env.timeoutMs,
    }),
    birdeye: new BirdeyeConnector({
      apiKey: overrides.birdeyeApiKey ?? env.birdeyeApiKey,
      mcpUrl: overrides.birdeyeMcpUrl ?? env.birdeyeMcpUrl,
      timeoutMs: overrides.timeoutMs ?? env.timeoutMs,
    }),
  };
}