/**
 * Clawd Connectors — Remote MCP client
 * Connects to a remote MCP server URL (e.g. https://api.paybox.sh/mcp?app=dflow)
 * using the Model Context Protocol SDK Streamable HTTP transport.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpCallResult, McpToolDefinition, ProviderId } from '../types.js';

export interface RemoteMcpClientOptions {
  provider: ProviderId;
  mcpUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class RemoteMcpClient {
  private readonly provider: ProviderId;
  private readonly mcpUrl: string;
  private readonly apiKey?: string;
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private toolCache: McpToolDefinition[] | null = null;

  constructor(options: RemoteMcpClientOptions) {
    this.provider = options.provider;
    this.mcpUrl = options.mcpUrl;
    this.apiKey = options.apiKey;
  }

  async connect(): Promise<void> {
    if (this.client) return;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['X-API-Key'] = this.apiKey;
    }

    this.transport = new StreamableHTTPClientTransport(new URL(this.mcpUrl), {
      requestInit: { headers },
    });

    this.client = new Client(
      { name: `clawd-connectors-${this.provider}`, version: '0.1.0' },
      { capabilities: {} },
    );

    await this.client.connect(this.transport);
  }

  async listTools(): Promise<McpToolDefinition[]> {
    await this.connect();
    if (this.toolCache) return this.toolCache;

    const result = await this.client!.listTools();
    this.toolCache = (result.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: (t.inputSchema ?? undefined) as Record<string, unknown> | undefined,
    }));
    return this.toolCache;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    await this.connect();
    const result = await this.client!.callTool({ name, arguments: args });
    return {
      content: (result.content ?? []) as McpCallResult['content'],
      isError: result.isError === true,
    };
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
      this.toolCache = null;
    }
  }
}

export function mcpUrlFor(provider: ProviderId): string {
  // If URL is not provided, fall back to the standard DFlow-style remote MCP pattern
  return provider === 'dflow' ? 'https://api.paybox.sh/mcp?app=dflow' : '';
}