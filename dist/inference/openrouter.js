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
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
/** Free Models Router — picks a free model that supports request features. */
export const OPENROUTER_FREE_ROUTER = "openrouter/free";
/** Auto router — paid intelligent model selection. */
export const OPENROUTER_AUTO_ROUTER = "openrouter/auto";
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
export function resolveOpenRouterEnv(env = process.env) {
    const freeModel = env.OPENROUTER_FREE_MODEL?.trim() || OPENROUTER_FREE_ROUTER;
    const preferFree = env.OPENROUTER_PREFER_FREE === "1" ||
        env.OPENROUTER_PREFER_FREE === "true" ||
        !env.OPENROUTER_MODEL?.trim();
    const defaultModel = preferFree
        ? freeModel
        : env.OPENROUTER_MODEL.trim() || freeModel;
    const sortRaw = env.OPENROUTER_PROVIDER_SORT?.trim().toLowerCase();
    const providerSort = sortRaw === "price" || sortRaw === "throughput" || sortRaw === "latency"
        ? sortRaw
        : undefined;
    return {
        apiKey: env.OPENROUTER_API_KEY?.trim() || undefined,
        defaultModel,
        lowComputeModel: freeModel,
        baseUrl: (env.OPENROUTER_BASE_URL?.trim() || OPENROUTER_BASE_URL).replace(/\/$/, ""),
        siteUrl: env.OPENROUTER_SITE_URL?.trim() ||
            env.OPENROUTER_HTTP_REFERER?.trim() ||
            "https://x402.wtf",
        appName: env.OPENROUTER_APP_NAME?.trim() ||
            env.OPENROUTER_TITLE?.trim() ||
            "Clawd Automaton",
        providerSort,
        preferFree,
    };
}
export function isOpenRouterConfigured(env = process.env) {
    return Boolean(env.OPENROUTER_API_KEY?.trim());
}
/**
 * Create an InferenceClient backed by OpenRouter chat completions.
 */
export function createOpenRouterInferenceClient(options) {
    const apiKey = options.apiKey;
    const baseUrl = (options.baseUrl || OPENROUTER_BASE_URL).replace(/\/$/, "");
    const defaultModel = options.defaultModel || OPENROUTER_FREE_ROUTER;
    const lowComputeModel = options.lowComputeModel || options.defaultModel || OPENROUTER_FREE_ROUTER;
    let currentModel = defaultModel;
    let maxTokens = options.maxTokens ?? 4096;
    const siteUrl = options.siteUrl || "https://x402.wtf";
    const appName = options.appName || "Clawd Automaton";
    const providerPrefs = options.provider;
    const chat = async (messages, opts) => {
        const model = opts?.model || currentModel;
        const tools = opts?.tools;
        const tokenLimit = opts?.maxTokens || maxTokens;
        const body = {
            model,
            messages: messages.map(formatMessage),
            stream: false,
            max_tokens: tokenLimit,
        };
        if (opts?.temperature !== undefined) {
            body.temperature = opts.temperature;
        }
        if (tools && tools.length > 0) {
            body.tools = tools;
            body.tool_choice = "auto";
        }
        if (providerPrefs && Object.keys(providerPrefs).length > 0) {
            body.provider = providerPrefs;
        }
        const resp = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "HTTP-Referer": siteUrl,
                "X-Title": appName,
            },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`OpenRouter inference error: ${resp.status}: ${text}`);
        }
        const data = (await resp.json());
        if (data.error?.message) {
            throw new Error(`OpenRouter error: ${data.error.message}`);
        }
        const choice = data.choices?.[0];
        if (!choice?.message) {
            throw new Error("No completion choice returned from OpenRouter");
        }
        const message = choice.message;
        const usage = {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
        };
        const toolCalls = message.tool_calls?.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
            },
        }));
        return {
            id: data.id || "",
            // Free router returns the actual selected model here
            model: data.model || model,
            message: {
                role: message.role || "assistant",
                content: message.content || "",
                tool_calls: toolCalls,
            },
            toolCalls,
            usage,
            finishReason: choice.finish_reason || "stop",
        };
    };
    const setLowComputeMode = (enabled) => {
        if (enabled) {
            currentModel = lowComputeModel;
            maxTokens = Math.min(maxTokens, 4096);
        }
        else {
            currentModel = defaultModel;
            maxTokens = options.maxTokens ?? 4096;
        }
    };
    const getDefaultModel = () => currentModel;
    return { chat, setLowComputeMode, getDefaultModel };
}
/**
 * Build OpenRouter client from process env (or provided env bag).
 * Returns null if OPENROUTER_API_KEY is missing.
 */
export function createOpenRouterFromEnv(env = process.env, overrides) {
    const resolved = resolveOpenRouterEnv(env);
    if (!resolved.apiKey)
        return null;
    const provider = resolved.providerSort
        ? { sort: resolved.providerSort }
        : undefined;
    return createOpenRouterInferenceClient({
        apiKey: overrides?.apiKey || resolved.apiKey,
        defaultModel: overrides?.defaultModel || resolved.defaultModel,
        lowComputeModel: overrides?.lowComputeModel || resolved.lowComputeModel,
        baseUrl: overrides?.baseUrl || resolved.baseUrl,
        siteUrl: overrides?.siteUrl || resolved.siteUrl,
        appName: overrides?.appName || resolved.appName,
        provider: overrides?.provider || provider,
        maxTokens: overrides?.maxTokens,
    });
}
function formatMessage(msg) {
    const formatted = {
        role: msg.role,
        content: msg.content,
    };
    if (msg.name)
        formatted.name = msg.name;
    if (msg.tool_calls)
        formatted.tool_calls = msg.tool_calls;
    if (msg.tool_call_id)
        formatted.tool_call_id = msg.tool_call_id;
    return formatted;
}
//# sourceMappingURL=openrouter.js.map