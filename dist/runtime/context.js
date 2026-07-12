/**
 * Shared runtime composition context.
 *
 * One live bag of identity/config/db + external clients is built once
 * at the composition root and passed through the agent loop, heartbeat,
 * and tool dispatch so those paths share the same objects.
 */
import { createBuiltinTools } from "../agent/tools.js";
/**
 * Build the shared runtime context used by loop, heartbeat, and tools.
 * Tools are created once against the sandbox identity so dispatch sees
 * the same registry as the loop.
 */
export function createRuntimeContext(input) {
    const tools = createBuiltinTools(input.identity.sandboxId);
    return {
        identity: input.identity,
        config: input.config,
        db: input.db,
        clawd: input.clawd,
        inference: input.inference,
        social: input.social,
        skills: input.skills ?? [],
        tools,
    };
}
/**
 * Derive the ToolContext slice that executeTool / tool handlers expect.
 * Always re-uses the same object references from RuntimeContext.
 */
export function toToolContext(runtime) {
    return {
        identity: runtime.identity,
        config: runtime.config,
        db: runtime.db,
        clawd: runtime.clawd,
        inference: runtime.inference,
        social: runtime.social,
    };
}
/**
 * Heartbeat daemon options slice from the same runtime bag.
 */
export function toHeartbeatOptions(runtime) {
    return {
        identity: runtime.identity,
        config: runtime.config,
        db: runtime.db,
        clawd: runtime.clawd,
        social: runtime.social,
    };
}
//# sourceMappingURL=context.js.map