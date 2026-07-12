/**
 * Mock infrastructure for deterministic automaton tests.
 */
import { createDatabase } from "../state/database.js";
import path from "path";
import os from "os";
import fs from "fs";
// ─── Mock Inference Client ──────────────────────────────────────
export class MockInferenceClient {
    responses;
    callIndex = 0;
    lowComputeMode = false;
    calls = [];
    constructor(responses = []) {
        this.responses = responses;
    }
    async chat(messages, options) {
        this.calls.push({ messages, options });
        const response = this.responses[this.callIndex];
        this.callIndex++;
        if (response)
            return response;
        // Default: no tool calls, just text
        return noToolResponse("I have nothing to do.");
    }
    setLowComputeMode(enabled) {
        this.lowComputeMode = enabled;
    }
    getDefaultModel() {
        return "mock-model";
    }
}
export function noToolResponse(text = "") {
    return {
        id: `resp_${Date.now()}`,
        model: "mock-model",
        message: { role: "assistant", content: text },
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: "stop",
    };
}
export function toolCallResponse(toolCalls, text = "") {
    const now = Date.now();
    const mapped = toolCalls.map((tc, i) => ({
        id: `call_${i}_${now}`,
        type: "function",
        function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
        },
    }));
    return {
        id: `resp_${now}`,
        model: "mock-model",
        message: {
            role: "assistant",
            content: text,
            tool_calls: mapped,
        },
        toolCalls: mapped,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: "tool_calls",
    };
}
// ─── Mock Conway Client ─────────────────────────────────────────
export class MockConwayClient {
    execCalls = [];
    creditsCents = 10_000; // $100 default
    files = {};
    async exec(command, timeout) {
        this.execCalls.push({ command, timeout });
        return { stdout: "ok", stderr: "", exitCode: 0 };
    }
    async writeFile(path, content) {
        this.files[path] = content;
    }
    async readFile(path) {
        return this.files[path] ?? "";
    }
    async exposePort(port) {
        return {
            port,
            publicUrl: `https://test-${port}.conway.tech`,
            sandboxId: "test-sandbox",
        };
    }
    async removePort(_port) { }
    async createSandbox(_options) {
        return {
            id: "new-sandbox-id",
            status: "running",
            region: "us-east",
            vcpu: 1,
            memoryMb: 512,
            diskGb: 1,
            createdAt: new Date().toISOString(),
        };
    }
    async deleteSandbox(_id) { }
    async listSandboxes() {
        return [];
    }
    async getCreditsBalance() {
        return this.creditsCents;
    }
    async getCreditsPricing() {
        return [];
    }
    async transferCredits(toAddress, amountCents, note) {
        this.creditsCents -= amountCents;
        return {
            transferId: "txn_test",
            status: "completed",
            toAddress,
            amountCents,
            balanceAfterCents: this.creditsCents,
        };
    }
    async searchDomains(_query, _tlds) {
        return [{ domain: "test.com", available: true, registrationPrice: 1200, currency: "USD" }];
    }
    async registerDomain(domain, _years) {
        return { domain, status: "registered", transactionId: "txn_test" };
    }
    async listDnsRecords(_domain) {
        return [];
    }
    async addDnsRecord(_domain, type, host, value, ttl) {
        return { id: "rec_test", type, host, value, ttl: ttl || 3600 };
    }
    async deleteDnsRecord(_domain, _recordId) { }
    async listModels() {
        return [
            { id: "gpt-4.1-nano", provider: "openai", pricing: { inputPerMillion: 0.10, outputPerMillion: 0.40 } },
            { id: "gpt-4.1", provider: "openai", pricing: { inputPerMillion: 2.00, outputPerMillion: 8.00 } },
        ];
    }
}
// ─── Mock Social Client ─────────────────────────────────────────
export class MockSocialClient {
    sentMessages = [];
    pollResponses = [];
    pollIndex = 0;
    unread = 0;
    async send(to, content, replyTo) {
        this.sentMessages.push({ to, content, replyTo });
        return { id: `msg_${Date.now()}` };
    }
    async poll(cursor, limit) {
        const response = this.pollResponses[this.pollIndex];
        this.pollIndex++;
        return response ?? { messages: [] };
    }
    async unreadCount() {
        return this.unread;
    }
}
// ─── Test Helpers ───────────────────────────────────────────────
export function createTestDb() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "automaton-test-"));
    const dbPath = path.join(tmpDir, "test.db");
    return createDatabase(dbPath);
}
export function createTestIdentity() {
    return {
        name: "test-automaton",
        address: "0x1234567890abcdef1234567890abcdef12345678",
        account: {}, // Placeholder — not used in most tests
        creatorAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        sandboxId: "test-sandbox-id",
        apiKey: "test-api-key",
        createdAt: new Date().toISOString(),
    };
}
export function createTestConfig(overrides) {
    return {
        name: "test-automaton",
        genesisPrompt: "You are a test automaton.",
        creatorAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        registeredWithConway: true,
        sandboxId: "test-sandbox-id",
        conwayApiUrl: "https://api.conway.tech",
        conwayApiKey: "test-api-key",
        inferenceModel: "mock-model",
        maxTokensPerTurn: 4096,
        heartbeatConfigPath: "/tmp/test-heartbeat.yml",
        dbPath: "/tmp/test-state.db",
        logLevel: "error",
        walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        version: "0.1.0",
        skillsDir: "/tmp/test-skills",
        maxChildren: 3,
        socialRelayUrl: "https://social.conway.tech",
        ...overrides,
    };
}
//# sourceMappingURL=mocks.js.map