/**
 * Clawd Connectors — DFlow
 * Remote MCP connector: https://api.paybox.sh/mcp?app=dflow
 * Fallback REST when DFLOW_API_KEY is set.
 */
import { BaseConnector } from './base.js';
import type { ProviderConfig } from '../types.js';

const DFLOW_REST_BASE = 'https://api.dflow.net';

export class DFlowConnector extends BaseConnector {
  protected restBase = DFLOW_REST_BASE;

  constructor(config: Partial<ProviderConfig> = {}) {
    super({ name: 'dflow', apiKey: '', ...config });
  }
}