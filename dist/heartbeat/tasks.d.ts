/**
 * Built-in Heartbeat Tasks
 *
 * These tasks run on the heartbeat schedule even while the agent sleeps.
 * They can trigger the agent to wake up if needed.
 */
import type { AutomatonConfig, AutomatonDatabase, ConwayClient, AutomatonIdentity, SocialClientInterface } from "../types.js";
export interface HeartbeatTaskContext {
    identity: AutomatonIdentity;
    config: AutomatonConfig;
    db: AutomatonDatabase;
    conway: ConwayClient;
    social?: SocialClientInterface;
}
export type HeartbeatTaskFn = (ctx: HeartbeatTaskContext) => Promise<{
    shouldWake: boolean;
    message?: string;
}>;
/**
 * Registry of built-in heartbeat tasks.
 */
export declare const BUILTIN_TASKS: Record<string, HeartbeatTaskFn>;
//# sourceMappingURL=tasks.d.ts.map