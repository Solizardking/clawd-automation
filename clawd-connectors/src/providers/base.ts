/**
 * Clawd Connectors — Base connector
 * Shared logic for MCP-backed provider connectors with REST fallback for
 * providers that expose an HTTP API key (Helius, Jupiter, Birdeye).
 */
import type {
  ClawdConnector,
  McpCallResult,
  McpToolDefinition,
  ProviderConfig,
  ProviderStatus,
} from '../types.js';
import { RemoteMcpClient } from '../mcp/client.js';

export abstract class BaseConnector implements ClawdConnector {
  readonly id: ProviderConfig['name'];
  protected config: ProviderConfig;
  protected mcp: RemoteMcpClient | null = null;

  constructor(config: ProviderConfig) {
    this.id = config.name;
    this.config = {
      timeoutMs: 15000,
      ...config,
    };
  }

  /** REST base URL for providers with an HTTP API key. Empty when MCP-only. */
  protected abstract restBase: string;

  protected ensureMcp(): RemoteMcpClient {
    if (!this.config.mcpUrl) {
      throw new Error(`${this.id}: no MCP URL configured`);
    }
    if (!this.mcp) {
      this.mcp = new RemoteMcpClient({
        provider: this.id,
        mcpUrl: this.config.mcpUrl,
        apiKey: this.config.apiKey,
        timeoutMs: this.config.timeoutMs,
      });
    }
    return this.mcp;
  }

  async listTools(): Promise<McpToolDefinition[]> {
    return this.ensureMcp().listTools();
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    return this.ensureMcp().callTool(name, args);
  }

  /** REST GET with the provider API key header */
  protected async restGet<T>(path: string, headers: Record<string, string> = {}): Promise<T> {
    const base = this.config.restBase ?? this.restBase;
    const res = await fetch(`${base}${path}`, {
      headers: {
        ...headers,
        ...(this.config.apiKey ? { 'x-api-key': this.config.apiKey } : {}),
      },
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 15000),
    });
    if (!res.ok) {
      throw new Error(`${this.id} REST ${path}: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  async status(): Promise<ProviderStatus> {
    const base: ProviderStatus = {
      provider: this.id,
      configured: !!this.config.apiKey || !!this.config.mcpUrl,
      mcpUrl: this.config.mcpUrl,
      restBase: this.config.restBase ?? this.restBase,
    };
    if (!base.configured) {
      base.error = `missing ${this.id.toUpperCase()}_API_KEY`;
      return base;
    }
    try {
      base.tools = await this.listTools();
    } catch (err) {
      base.error = (err as Error).message;
    }
    return base;
  }
}