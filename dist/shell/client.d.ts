/**
 * Clawd Shell Client — local host runtime.
 *
 * exec / filesystem run on the host process. Credits, sandboxes, and
 * domains are local stubs so the agent loop stays offline-capable with
 * OpenRouter + Clawd packages. Credit balance: CLAWD_CREDITS_CENTS / getCreditsBalance.
 */
import type { ClawdClient } from "../types.js";
export interface ClawdClientOptions {
    /** Logical host id (local sandbox). Default: local */
    sandboxId?: string;
    /** Starting credit balance in cents for survival tiers. */
    creditsCents?: number;
    /** Working directory for relative paths. */
    cwd?: string;
    /** OpenRouter API key for listModels (optional). */
    openRouterApiKey?: string;
}
export declare function createClawdClient(options?: ClawdClientOptions): ClawdClient;
//# sourceMappingURL=client.d.ts.map