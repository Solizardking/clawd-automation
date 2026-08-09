/**
 * Clawd Connectors — Jupiter
 * MCP connector with REST fallback to https://quote-api.jup.ag / api.jup.ag
 */
import { BaseConnector } from './base.js';
import type { ProviderConfig } from '../types.js';

const JUPITER_REST_BASE = 'https://quote-api.jup.ag';

export class JupiterConnector extends BaseConnector {
  protected restBase = JUPITER_REST_BASE;

  constructor(config: Partial<ProviderConfig> = {}) {
    super({ name: 'jupiter', apiKey: '', ...config });
  }

  /** Quote convenience (v6) */
  async quote(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
  }): Promise<{ outAmount: string; routePlan: unknown[] }> {
    const qs = new URLSearchParams({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: String(params.amount),
      ...(params.slippageBps ? { slippageBps: String(params.slippageBps) } : {}),
    });
    return this.restGet<{ outAmount: string; routePlan: unknown[] }>(`/v6/quote?${qs.toString()}`);
  }
}