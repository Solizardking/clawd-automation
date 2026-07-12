/**
 * Inference provider resolution for the primary automaton runtime.
 *
 * Priority (INFERENCE_PROVIDER=auto, default):
 * 1. OpenRouter when OPENROUTER_API_KEY is set (free router by default)
 * 2. Conway /v1/chat/completions with sandbox API key
 *
 * Set INFERENCE_PROVIDER=openrouter|conway to force a backend.
 */

import type { InferenceClient } from "../types.js";
import { createInferenceClient } from "../conway/inference.js";
import {
  createOpenRouterFromEnv,
  isOpenRouterConfigured,
  resolveOpenRouterEnv,
} from "./openrouter.js";

export type InferenceBackend = "openrouter" | "conway" | "auto";

export interface ResolveInferenceOptions {
  /** Conway API base URL (used when backend is conway). */
  conwayApiUrl: string;
  /** Conway API key. */
  conwayApiKey: string;
  /** Configured model for Conway path. */
  conwayModel: string;
  maxTokens: number;
  env?: NodeJS.ProcessEnv;
}

export interface ResolvedInference {
  client: InferenceClient;
  backend: "openrouter" | "conway";
  model: string;
  detail: string;
}

export function resolveInferenceBackend(
  env: NodeJS.ProcessEnv = process.env,
): InferenceBackend {
  const raw = (env.INFERENCE_PROVIDER || "auto").trim().toLowerCase();
  if (raw === "openrouter" || raw === "conway" || raw === "auto") {
    return raw;
  }
  return "auto";
}

/**
 * Create the inference client for --run based on env + Conway credentials.
 */
export function resolveInferenceClient(
  options: ResolveInferenceOptions,
): ResolvedInference {
  const env = options.env ?? process.env;
  const mode = resolveInferenceBackend(env);
  const orConfigured = isOpenRouterConfigured(env);
  const orEnv = resolveOpenRouterEnv(env);

  const useOpenRouter =
    mode === "openrouter" || (mode === "auto" && orConfigured);

  if (useOpenRouter) {
    if (!orConfigured) {
      throw new Error(
        "INFERENCE_PROVIDER=openrouter but OPENROUTER_API_KEY is not set",
      );
    }
    const client = createOpenRouterFromEnv(env, {
      maxTokens: options.maxTokens,
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

  const client = createInferenceClient({
    apiUrl: options.conwayApiUrl,
    apiKey: options.conwayApiKey,
    defaultModel: options.conwayModel,
    maxTokens: options.maxTokens,
    lowComputeModel: orEnv.lowComputeModel.includes("free")
      ? undefined
      : "gpt-4o-mini",
  });

  return {
    client,
    backend: "conway",
    model: client.getDefaultModel(),
    detail: `Conway model=${client.getDefaultModel()} api=${options.conwayApiUrl}`,
  };
}
