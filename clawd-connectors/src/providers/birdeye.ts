/**
 * Clawd Connectors — Birdeye
 * MCP connector with REST fallback to https://public-api.birdeye.so
 */
import { BaseConnector } from './base.js';
import type { ProviderConfig } from '../types.js';

const BIRDEYE_REST_BASE = 'https://public-api.birdeye.so';

export class BirdeyeConnector extends BaseConnector {
  protected restBase = BIRDEYE_REST_BASE;

  constructor(config: Partial<ProviderConfig> = {}) {
    super({ name: 'birdeye', apiKey: '', ...config });
  }
}