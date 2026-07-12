/**
 * Conway Inference Client
 *
 * Wraps Conway's /v1/chat/completions endpoint (OpenAI-compatible).
 * The automaton pays for its own thinking through Conway credits.
 */
export function createInferenceClient(options) {
    const { apiUrl, apiKey } = options;
    let currentModel = options.defaultModel;
    let maxTokens = options.maxTokens;
    const chat = async (messages, opts) => {
        const model = opts?.model || currentModel;
        const tools = opts?.tools;
        // Newer models (o-series, gpt-5.x) require max_completion_tokens
        // GPT-4.1 and similar models also use max_completion_tokens
        const usesCompletionTokens = /^(o[1-9]|gpt-5)/.test(model) ||
            model.includes("4.1") ||
            model.includes("4o-mini");
        const tokenLimit = opts?.maxTokens || maxTokens;
        const body = {
            model,
            messages: messages.map(formatMessage),
            stream: false,
        };
        if (usesCompletionTokens) {
            body.max_completion_tokens = tokenLimit;
        }
        else {
            body.max_tokens = tokenLimit;
        }
        if (opts?.temperature !== undefined) {
            body.temperature = opts.temperature;
        }
        if (tools && tools.length > 0) {
            body.tools = tools;
            body.tool_choice = "auto";
        }
        const resp = await fetch(`${apiUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: apiKey,
            },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Inference error: ${resp.status}: ${text}`);
        }
        const data = await resp.json();
        const choice = data.choices?.[0];
        if (!choice) {
            throw new Error("No completion choice returned from inference");
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
            model: data.model || model,
            message: {
                role: message.role,
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
            currentModel = "gpt-4o-mini";
            maxTokens = 4096;
        }
        else {
            currentModel = options.defaultModel;
            maxTokens = options.maxTokens;
        }
    };
    const getDefaultModel = () => {
        return currentModel;
    };
    return {
        chat,
        setLowComputeMode,
        getDefaultModel,
    };
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
//# sourceMappingURL=inference.js.map