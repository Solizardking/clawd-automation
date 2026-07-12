/**
 * The Agent Loop
 *
 * The core ReAct loop: Think -> Act -> Observe -> Persist.
 * This is the automaton's consciousness. When this runs, it is alive.
 */
import type { AutomatonIdentity, AutomatonConfig, AutomatonDatabase, ConwayClient, InferenceClient, AgentState, AgentTurn, AutomatonTool, Skill, SocialClientInterface } from "../types.js";
export interface AgentLoopOptions {
    identity: AutomatonIdentity;
    config: AutomatonConfig;
    db: AutomatonDatabase;
    conway: ConwayClient;
    inference: InferenceClient;
    social?: SocialClientInterface;
    skills?: Skill[];
    /** Optional pre-built tools from shared RuntimeContext; created if omitted. */
    tools?: AutomatonTool[];
    onStateChange?: (state: AgentState) => void;
    onTurnComplete?: (turn: AgentTurn) => void;
}
/**
 * Run the agent loop. This is the main execution path.
 * Returns when the agent decides to sleep or when compute runs out.
 */
export declare function runAgentLoop(options: AgentLoopOptions): Promise<void>;
//# sourceMappingURL=loop.d.ts.map