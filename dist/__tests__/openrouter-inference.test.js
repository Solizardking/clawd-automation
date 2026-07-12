/**
 * OpenRouter free-router + resolve-inference tests.
 * Drives real shipped clients with mocked fetch at the network edge.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createOpenRouterInferenceClient, createOpenRouterFromEnv, resolveOpenRouterEnv, isOpenRouterConfigured, OPENROUTER_FREE_ROUTER, } from "../inference/openrouter.js";
import { resolveInferenceClient, resolveInferenceBackend, } from "../inference/resolve.js";
const originalFetch = globalThis.fetch;
describe("resolveOpenRouterEnv", () => {
    it("defaults free model to openrouter/free and prefers free when MODEL unset", () => {
        const cfg = resolveOpenRouterEnv({
            OPENROUTER_API_KEY: "sk-or-test",
            OPENROUTER_FREE_MODEL: undefined,
            OPENROUTER_MODEL: undefined,
        });
        expect(cfg.apiKey).toBe("sk-or-test");
        expect(cfg.defaultModel).toBe(OPENROUTER_FREE_ROUTER);
        expect(cfg.lowComputeModel).toBe(OPENROUTER_FREE_ROUTER);
        expect(cfg.preferFree).toBe(true);
    });
    it("honors OPENROUTER_FREE_MODEL override", () => {
        const cfg = resolveOpenRouterEnv({
            OPENROUTER_API_KEY: "k",
            OPENROUTER_FREE_MODEL: "meta-llama/llama-3.2-3b-instruct:free",
        });
        expect(cfg.defaultModel).toBe("meta-llama/llama-3.2-3b-instruct:free");
        expect(cfg.lowComputeModel).toBe("meta-llama/llama-3.2-3b-instruct:free");
    });
    it("uses OPENROUTER_MODEL when prefer free is not forced", () => {
        const cfg = resolveOpenRouterEnv({
            OPENROUTER_API_KEY: "k",
            OPENROUTER_MODEL: "openrouter/auto",
            OPENROUTER_FREE_MODEL: "openrouter/free",
        });
        expect(cfg.preferFree).toBe(false);
        expect(cfg.defaultModel).toBe("openrouter/auto");
        expect(cfg.lowComputeModel).toBe("openrouter/free");
    });
    it("parses provider sort", () => {
        const cfg = resolveOpenRouterEnv({
            OPENROUTER_API_KEY: "k",
            OPENROUTER_PROVIDER_SORT: "throughput",
        });
        expect(cfg.providerSort).toBe("throughput");
    });
});
describe("createOpenRouterInferenceClient", () => {
    let fetchMock;
    beforeEach(() => {
        fetchMock = vi.fn();
        globalThis.fetch = fetchMock;
    });
    afterEach(() => {
        globalThis.fetch = originalFetch;
    });
    it("POSTs to OpenRouter with free router model and auth headers", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                id: "gen-1",
                model: "upstage/solar-pro-3:free",
                choices: [
                    {
                        message: { role: "assistant", content: "hello from free" },
                        finish_reason: "stop",
                    },
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 5,
                    total_tokens: 15,
                },
            }),
        });
        const client = createOpenRouterInferenceClient({
            apiKey: "sk-or-v1-test",
            defaultModel: OPENROUTER_FREE_ROUTER,
            siteUrl: "https://x402.wtf",
            appName: "Clawd Automaton",
            provider: { sort: "price" },
        });
        const result = await client.chat([
            { role: "user", content: "Hello! What can you help me with today?" },
        ]);
        expect(result.message.content).toBe("hello from free");
        // Free router reports the actual selected model
        expect(result.model).toBe("upstage/solar-pro-3:free");
        expect(result.usage.totalTokens).toBe(15);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
        expect(init.method).toBe("POST");
        expect(init.headers.Authorization).toBe("Bearer sk-or-v1-test");
        expect(init.headers["HTTP-Referer"]).toBe("https://x402.wtf");
        expect(init.headers["X-Title"]).toBe("Clawd Automaton");
        const body = JSON.parse(init.body);
        expect(body.model).toBe("openrouter/free");
        expect(body.messages[0].content).toContain("Hello");
        expect(body.provider).toEqual({ sort: "price" });
    });
    it("setLowComputeMode switches to free model", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                id: "g2",
                model: "openrouter/free",
                choices: [
                    { message: { role: "assistant", content: "ok" }, finish_reason: "stop" },
                ],
                usage: {},
            }),
        });
        const client = createOpenRouterInferenceClient({
            apiKey: "k",
            defaultModel: "openrouter/auto",
            lowComputeModel: "openrouter/free",
        });
        client.setLowComputeMode(true);
        expect(client.getDefaultModel()).toBe("openrouter/free");
        await client.chat([{ role: "user", content: "x" }]);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.model).toBe("openrouter/free");
    });
    it("forwards tools for free-router capability filtering", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                id: "g3",
                model: "some/tool-model:free",
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: null,
                            tool_calls: [
                                {
                                    id: "call_1",
                                    type: "function",
                                    function: { name: "exec", arguments: "{}" },
                                },
                            ],
                        },
                        finish_reason: "tool_calls",
                    },
                ],
                usage: {},
            }),
        });
        const client = createOpenRouterInferenceClient({
            apiKey: "k",
            defaultModel: "openrouter/free",
        });
        const result = await client.chat([{ role: "user", content: "run" }], {
            tools: [
                {
                    type: "function",
                    function: {
                        name: "exec",
                        description: "run",
                        parameters: { type: "object", properties: {} },
                    },
                },
            ],
        });
        expect(result.toolCalls?.[0].function.name).toBe("exec");
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.tools).toHaveLength(1);
        expect(body.tool_choice).toBe("auto");
    });
});
describe("resolveInferenceClient", () => {
    it("uses openrouter when key present", () => {
        const resolved = resolveInferenceClient({
            maxTokens: 2048,
            env: {
                OPENROUTER_API_KEY: "sk-or-test",
                OPENROUTER_FREE_MODEL: "openrouter/free",
                INFERENCE_PROVIDER: "auto",
            },
        });
        expect(resolved.backend).toBe("openrouter");
        expect(resolved.model).toBe("openrouter/free");
        expect(resolved.detail).toMatch(/OpenRouter/);
    });
    it("throws when openrouter key missing", () => {
        expect(() => resolveInferenceClient({
            maxTokens: 2048,
            env: { INFERENCE_PROVIDER: "auto" },
        })).toThrow(/OPENROUTER_API_KEY/);
    });
    it("maps legacy clawd/conway provider to openrouter", () => {
        const resolved = resolveInferenceClient({
            maxTokens: 1024,
            env: {
                OPENROUTER_API_KEY: "sk-or",
                OPENROUTER_FREE_MODEL: "openrouter/free",
                INFERENCE_PROVIDER: "clawd",
            },
        });
        expect(resolved.backend).toBe("openrouter");
    });
    it("throws when openrouter forced without key", () => {
        expect(() => resolveInferenceClient({
            maxTokens: 100,
            env: { INFERENCE_PROVIDER: "openrouter" },
        })).toThrow(/OPENROUTER_API_KEY/);
    });
});
describe("isOpenRouterConfigured / createOpenRouterFromEnv", () => {
    it("detects missing key", () => {
        expect(isOpenRouterConfigured({})).toBe(false);
        expect(createOpenRouterFromEnv({})).toBeNull();
    });
    it("builds client from env", () => {
        const client = createOpenRouterFromEnv({
            OPENROUTER_API_KEY: "sk-or",
            OPENROUTER_FREE_MODEL: "openrouter/free",
        });
        expect(client).not.toBeNull();
        expect(client.getDefaultModel()).toBe("openrouter/free");
    });
});
describe("resolveInferenceBackend", () => {
    it("defaults to auto", () => {
        expect(resolveInferenceBackend({})).toBe("auto");
    });
});
//# sourceMappingURL=openrouter-inference.test.js.map