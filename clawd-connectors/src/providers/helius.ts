/**
 * Clawd Connectors — Helius
 * MCP connector with REST fallback to https://api.helius.dev
 */
import { BaseConnector } from './base.js';
import type { ProviderConfig } from '../types.js';

const HELIUS_REST_BASE = 'https://api.helius.dev';

export class HeliusConnector extends BaseConnector {
  protected restBase = HELIUS_REST_BASE;

  constructor(config: Partial<ProviderConfig> = {}) {
    super({ name: 'helius', apiKey: '', ...config });
  }

  /** RPC-style convenience: POST JSON-RPC to Helius */
  async rpc<T>(method: string, params: unknown[] = []): Promise<T> {
    const base = this.config.restBase ?? HELIUS_REST_BASE;
    const res = await fetch(
      `${base}/v0/rpc/${this.config.apiKey ? `?api-key=${this.config.apiKey}` : ''}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 15000),
      },
    );
    if (!res.ok) throw new Error(`helius rpc ${method}: ${res.status} ${res.statusText}`);
    const json = (await res.json()) as { result?: T; error?: { message?: string } };
    if (json.error) throw new Error(`helius rpc ${method}: ${json.error.message}`);
    return json.result as T;
  }
}