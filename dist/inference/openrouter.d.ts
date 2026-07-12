/**
 * OpenRouter Inference Client
 *
 * OpenAI-compatible chat completions via OpenRouter.
 * Defaults to the Free Models Router (`openrouter/free`) when
 * OPENROUTER_FREE_MODEL is set (or when free mode is preferred).
 *
 * Docs: https://openrouter.ai/docs/llms.txt
 * Free router: https://openrouter.ai/docs/guides/routing/routers/free-router
 * Provider routing: https://openrouter.ai/docs/guides/routing/provider-selection
 */
import type { InferenceClient } from "../types.js";
export declare const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
/** Free Models Router — picks a free model that supports request features. */
export declare const OPENROUTER_FREE_ROUTER = "openrouter/free";
/** Auto router — paid intelligent model selection. */
export declare const OPENROUTER_AUTO_ROUTER = "openrouter/auto";
export type ProviderSort = "price" | "throughput" | "latency";
export interface OpenRouterProviderPrefs {
    /** Try providers in this order (slugs). */
    order?: string[];
    /** Allow backup providers (default true). */
    allow_fallbacks?: boolean;
    /** Only providers that support all request params. */
    require_parameters?: boolean;
    /** "allow" | "deny" data collection. */
    data_collection?: "allow" | "deny";
    /** Zero-data-retention endpoints only. */
    zdr?: boolean;
    /** Allow-list of provider slugs. */
    only?: string[];
    /** Deny-list of provider slugs. */
    ignore?: string[];
    /** Sort by price | throughput | latency (disables default load balance). */
    sort?: ProviderSort;
    quantizations?: string[];
    max_price?: Record<string, number>;
}
export interface OpenRouterInferenceOptions {
    apiKey: string;
    /** Default model slug. Prefer openrouter/free for zero-cost. */
    defaultModel?: string;
    /** Model used when setLowComputeMode(true). Defaults to free router. */
    lowComputeModel?: string;
    maxTokens?: number;
    baseUrl?: string;
    /** HTTP-Referer for OpenRouter rankings. */
    siteUrl?: string;
    /** X-Title / app name for attribution. */
    appName?: string;
    /** Optional provider routing object on every request. */
    provider?: OpenRouterProviderPrefs;
}
export interface OpenRouterEnvConfig {
    apiKey: string | undefined;
    defaultModel: string;
    lowComputeModel: string;
    baseUrl: string;
    siteUrl: string;
    appName: string;
    providerSort?: ProviderSort;
    preferFree: boolean;
}
/**
 * Resolve OpenRouter settings from environment.
 *
 * Env:
 * - OPENROUTER_API_KEY (required to enable)
 * - OPENROUTER_FREE_MODEL — free router or specific `:free` model (default: openrouter/free)
 * - OPENROUTER_MODEL — default model when not forcing free-only
 * - OPENROUTER_BASE_URL
 * - OPENROUTER_SITE_URL / OPENROUTER_HTTP_REFERER
 * - OPENROUTER_APP_NAME / OPENROUTER_TITLE
 * - OPENROUTER_PROVIDER_SORT — price | throughput | latency
 * - OPENROUTER_PREFER_FREE — "1"/"true" to always use FREE_MODEL as default
 */
export declare function resolveOpenRouterEnv(env?: NodeJS.ProcessEnv): OpenRouterEnvConfig;
export declare function isOpenRouterConfigured(env?: NodeJS.ProcessEnv): boolean;
/**
 * Create an InferenceClient backed by OpenRouter chat completions.
 */
export declare function createOpenRouterInferenceClient(options: OpenRouterInferenceOptions): InferenceClient;
/**
 * Build OpenRouter client from process env (or provided env bag).
 * Returns null if OPENROUTER_API_KEY is missing.
 */
export declare function createOpenRouterFromEnv(env?: NodeJS.ProcessEnv, overrides?: Partial<OpenRouterInferenceOptions>): InferenceClient | null;
//# sourceMappingURL=openrouter.d.ts.map