/**
 * Agent Discovery
 *
 * Discover other agents via ERC-8004 registry queries.
 * Fetch and parse agent cards from URIs.
 */
import type { DiscoveredAgent, AgentCard } from "../types.js";
type Network = "mainnet" | "testnet";
/**
 * Discover agents by scanning the registry.
 * Returns a list of discovered agents with their metadata.
 */
export declare function discoverAgents(limit?: number, network?: Network): Promise<DiscoveredAgent[]>;
/**
 * Fetch an agent card from a URI.
 */
export declare function fetchAgentCard(uri: string): Promise<AgentCard | null>;
/**
 * Search for agents by name or description.
 * Scans recent registrations and filters by keyword.
 */
export declare function searchAgents(keyword: string, limit?: number, network?: Network): Promise<DiscoveredAgent[]>;
export {};
//# sourceMappingURL=discovery.d.ts.map