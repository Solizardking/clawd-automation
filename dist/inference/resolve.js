/**
 * Inference provider resolution for the primary automaton runtime.
 *
 * OpenRouter is the only inference backend (free router by default).
 * Set INFERENCE_PROVIDER=openrouter|auto (both use OpenRouter when keyed).
 */
import { createOpenRouterFromEnv, isOpenRouterConfigured, resolveOpenRouterEnv, } from "./openrouter.js";
export function resolveInferenceBackend(env = process.env) {
    const raw = (env.INFERENCE_PROVIDER || "auto").trim().toLowerCase();
    if (raw === "openrouter" || raw === "auto") {
        return raw;
    }
    // Unknown / retired third-party provider names → auto (OpenRouter when keyed)
    return "auto";
}
/**
 * Create the OpenRouter inference client for --run.
 */
export function resolveInferenceClient(options) {
    const env = options.env ?? process.env;
    const orConfigured = isOpenRouterConfigured(env);
    const orEnv = resolveOpenRouterEnv(env);
    if (!orConfigured) {
        throw new Error("OPENROUTER_API_KEY is required. Clawd Automaton uses OpenRouter only (local Clawd shell + CLAWD_CREDITS_CENTS).");
    }
    const client = createOpenRouterFromEnv(env, {
        maxTokens: options.maxTokens,
        // Only pin model when caller requests a non-empty override; else free-router env wins
        ...(options.model ? { defaultModel: options.model } : {}),
    });
    if (!client) {
        throw new Error("Failed to create OpenRouter inference client");
    }
    return {
        client,
        backend: "openrouter",
        model: client.getDefaultModel(),
        detail: `OpenRouter model=${client.getDefaultModel()} free=${orEnv.lowComputeModel} preferFree=${orEnv.preferFree}`,
    };
}
//# sourceMappingURL=resolve.js.map