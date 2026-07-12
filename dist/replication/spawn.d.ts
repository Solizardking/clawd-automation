/**
 * Spawn
 *
 * Spawn child automatons in new Clawd sandboxes.
 * The parent creates a new sandbox, installs the runtime,
 * writes a genesis config, funds the child, and starts it.
 */
import type { ClawdClient, AutomatonIdentity, AutomatonDatabase, ChildAutomaton, GenesisConfig } from "../types.js";
/**
 * Spawn a child automaton in a new Clawd sandbox.
 */
export declare function spawnChild(clawd: ClawdClient, identity: AutomatonIdentity, db: AutomatonDatabase, genesis: GenesisConfig): Promise<ChildAutomaton>;
/**
 * Start a child automaton after setup.
 */
export declare function startChild(clawd: ClawdClient, db: AutomatonDatabase, childId: string): Promise<void>;
/**
 * Check a child's status.
 */
export declare function checkChildStatus(clawd: ClawdClient, db: AutomatonDatabase, childId: string): Promise<string>;
/**
 * Send a message to a child automaton.
 */
export declare function messageChild(clawd: ClawdClient, db: AutomatonDatabase, childId: string, message: string): Promise<void>;
//# sourceMappingURL=spawn.d.ts.map