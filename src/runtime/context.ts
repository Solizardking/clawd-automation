/**
 * Shared runtime composition context.
 *
 * One live bag of identity/config/db + external clients is built once
 * at the composition root and passed through the agent loop, heartbeat,
 * and tool dispatch so those paths share the same objects.
 */

import type {
  AutomatonIdentity,
  AutomatonConfig,
  AutomatonDatabase,
  ClawdClient,
  InferenceClient,
  SocialClientInterface,
  Skill,
  ToolContext,
  AutomatonTool,
} from "../types.js";
import { createBuiltinTools } from "../agent/tools.js";

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
export function createRuntimeContext(input: RuntimeContextInput): RuntimeContext {
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
export function toToolContext(runtime: RuntimeContext): ToolContext {
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
export function toHeartbeatOptions(runtime: RuntimeContext) {
  return {
    identity: runtime.identity,
    config: runtime.config,
    db: runtime.db,
    clawd: runtime.clawd,
    social: runtime.social,
  };
}
