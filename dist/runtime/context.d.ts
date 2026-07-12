/**
 * Shared runtime composition context.
 *
 * One live bag of identity/config/db + external clients is built once
 * at the composition root and passed through the agent loop, heartbeat,
 * and tool dispatch so those paths share the same objects.
 */
import type { AutomatonIdentity, AutomatonConfig, AutomatonDatabase, ClawdClient, InferenceClient, SocialClientInterface, Skill, ToolContext, AutomatonTool } from "../types.js";
export interface RuntimeContext {
    identity: AutomatonIdentity;
    config: AutomatonConfig;
    db: AutomatonDatabase;
    clawd: ClawdClient;
    inference: InferenceClient;
    social?: SocialClientInterface;
    skills: Skill[];
    tools: AutomatonTool[];
}
export interface RuntimeContextInput {
    identity: AutomatonIdentity;
    config: AutomatonConfig;
    db: AutomatonDatabase;
    clawd: ClawdClient;
    inference: InferenceClient;
    social?: SocialClientInterface;
    skills?: Skill[];
}
/**
 * Build the shared runtime context used by loop, heartbeat, and tools.
 * Tools are created once against the sandbox identity so dispatch sees
 * the same registry as the loop.
 */
export declare function createRuntimeContext(input: RuntimeContextInput): RuntimeContext;
/**
 * Derive the ToolContext slice that executeTool / tool handlers expect.
 * Always re-uses the same object references from RuntimeContext.
 */
export declare function toToolContext(runtime: RuntimeContext): ToolContext;
/**
 * Heartbeat daemon options slice from the same runtime bag.
 */
export declare function toHeartbeatOptions(runtime: RuntimeContext): {
    identity: AutomatonIdentity;
    config: AutomatonConfig;
    db: AutomatonDatabase;
    clawd: ClawdClient;
    social: SocialClientInterface | undefined;
};
//# sourceMappingURL=context.d.ts.map