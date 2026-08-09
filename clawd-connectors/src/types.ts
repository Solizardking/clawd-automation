/**
 * Clawd Connectors — shared types
 */

export type ProviderId = 'dflow' | 'helius' | 'jupiter' | 'birdeye';

export interface ProviderConfig {
  /** Provider name */
  name: ProviderId;
  /** API key for REST calls */
  apiKey: string;
  /** Remote MCP server URL (e.g. https://api.paybox.sh/mcp?app=dflow) */
  mcpUrl?: string;
  /** REST base URL */
  restBase?: string;
  /** Timeout in ms */
  timeoutMs?: number;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export interface ProviderStatus {
  provider: ProviderId;
  configured: boolean;
  mcpUrl?: string;
  restBase?: string;
  tools?: McpToolDefinition[];
  error?: string;
}

export interface ClawdConnector {
  readonly id: ProviderId;
  /** List available MCP tools */
  listTools(): Promise<McpToolDefinition[]>;
  /** Call an MCP tool by name with JSON args */
  callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult>;
  /** Check connectivity / config */
  status(): Promise<ProviderStatus>;
}

export interface ConnectorsOptions {
  dflowApiKey?: string;
  heliusApiKey?: string;
  jupiterApiKey?: string;
  birdeyeApiKey?: string;
  dflowMcpUrl?: string;
  heliusMcpUrl?: string;
  jupiterMcpUrl?: string;
  birdeyeMcpUrl?: string;
  timeoutMs?: number;
}