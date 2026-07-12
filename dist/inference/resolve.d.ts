/**
 * Inference provider resolution for the primary automaton runtime.
 *
 * OpenRouter is the only inference backend (free router by default).
 * Set INFERENCE_PROVIDER=openrouter|auto (both use OpenRouter when keyed).
 */
import type { InferenceClient } from "../types.js";
export type InferenceBackend = "openrouter" | "auto";
export interface ResolveInferenceOptions {
    /** Preferred model label (OpenRouter model id). */
    model?: string;
    maxTokens: number;
    env?: NodeJS.ProcessEnv;
}
export interface ResolvedInference {
    client: InferenceClient;
    backend: "openrouter";
    model: string;
    detail: string;
}
export declare function resolveInferenceBackend(env?: NodeJS.ProcessEnv): InferenceBackend;
/**
 * Create the OpenRouter inference client for --run.
 */
export declare function resolveInferenceClient(options: ResolveInferenceOptions): ResolvedInference;
//# sourceMappingURL=resolve.d.ts.map