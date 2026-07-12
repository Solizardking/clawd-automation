/**
 * Inference provider resolution for the primary automaton runtime.
 *
 * OpenRouter is the only inference backend (free router by default).
 * Set INFERENCE_PROVIDER=openrouter|auto (both use OpenRouter when keyed).
 */

import type { InferenceClient } from "../types.js";
import {
  createOpenRouterFromEnv,
  isOpenRouterConfigured,
  resolveOpenRouterEnv,
} from "./openrouter.js";

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

export function resolveInferenceBackend(
  env: NodeJS.ProcessEnv = process.env,
): InferenceBackend {
  const raw = (env.INFERENCE_PROVIDER || "auto").trim().toLowerCase();
  if (raw === "openrouter" || raw === "auto") {
    return raw;
  }
  // Legacy aliases (conway/clawd paid control-plane inference removed)
  if (raw === "conway" || raw === "clawd") {
    return "openrouter";
  }
  return "auto";
}

/**
 * Create the OpenRouter inference client for --run.
 */
export function resolveInferenceClient(
  options: ResolveInferenceOptions,
): ResolvedInference {
  const env = options.env ?? process.env;
  const orConfigured = isOpenRouterConfigured(env);
  const orEnv = resolveOpenRouterEnv(env);

  if (!orConfigured) {
    throw new Error(
      "OPENROUTER_API_KEY is required. Clawd Automaton uses OpenRouter only (no Conway control plane).",
    );
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
