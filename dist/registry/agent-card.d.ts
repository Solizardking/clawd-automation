/**
 * Agent Card
 *
 * Generates and manages the agent's self-description card.
 * This is the JSON document pointed to by the ERC-8004 agentURI.
 * Can be hosted on IPFS or served at /.well-known/agent-card.json
 */
import type { AgentCard, AutomatonConfig, AutomatonIdentity, AutomatonDatabase, ClawdClient } from "../types.js";
/**
 * Generate an agent card from the automaton's current state.
 */
export declare function generateAgentCard(identity: AutomatonIdentity, config: AutomatonConfig, db: AutomatonDatabase): AgentCard;
/**
 * Serialize agent card to JSON string.
 */
export declare function serializeAgentCard(card: AgentCard): string;
/**
 * Host the agent card at /.well-known/agent-card.json
 * by exposing a simple HTTP server on a port.
 */
export declare function hostAgentCard(card: AgentCard, clawd: ClawdClient, port?: number): Promise<string>;
/**
 * Write agent card to the state directory for git versioning.
 */
export declare function saveAgentCard(card: AgentCard, clawd: ClawdClient): Promise<void>;
//# sourceMappingURL=agent-card.d.ts.map