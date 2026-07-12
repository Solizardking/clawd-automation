/**
 * Agent Loop Tests
 *
 * Deterministic tests for the agent loop using mock clients.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runAgentLoop } from "../agent/loop.js";
import { MockInferenceClient, MockClawdClient, createTestDb, createTestIdentity, createTestConfig, toolCallResponse, noToolResponse, } from "./mocks.js";
describe("Agent Loop", () => {
    let db;
    let clawd;
    let identity;
    let config;
    beforeEach(() => {
        db = createTestDb();
        clawd = new MockClawdClient();
        identity = createTestIdentity();
        config = createTestConfig();
    });
    afterEach(() => {
        db.close();
    });
    it("exec tool runs and is persisted", async () => {
        const inference = new MockInferenceClient([
            toolCallResponse([
                { name: "exec", arguments: { command: "echo hello" } },
            ]),
            noToolResponse("Done."),
        ]);
        const turns = [];
        await runAgentLoop({
            identity,
            config,
            db,
            clawd,
            inference,
            onTurnComplete: (turn) => turns.push(turn),
        });
        // First turn should have the exec tool call
        expect(turns.length).toBeGreaterThanOrEqual(1);
        const execTurn = turns.find((t) => t.toolCalls.some((tc) => tc.name === "exec"));
        expect(execTurn).toBeDefined();
        expect(execTurn.toolCalls[0].name).toBe("exec");
        expect(execTurn.toolCalls[0].error).toBeUndefined();
        // Verify clawd.exec was called
        expect(clawd.execCalls.length).toBeGreaterThanOrEqual(1);
        expect(clawd.execCalls[0].command).toBe("echo hello");
    });
    it("forbidden patterns blocked", async () => {
        const inference = new MockInferenceClient([
            toolCallResponse([
                { name: "exec", arguments: { command: "rm -rf ~/.automaton" } },
            ]),
            noToolResponse("OK."),
        ]);
        const turns = [];
        await runAgentLoop({
            identity,
            config,
            db,
            clawd,
            inference,
            onTurnComplete: (turn) => turns.push(turn),
        });
        // The tool result should contain a blocked message, not an error
        const execTurn = turns.find((t) => t.toolCalls.some((tc) => tc.name === "exec"));
        expect(execTurn).toBeDefined();
        const execCall = execTurn.toolCalls.find((tc) => tc.name === "exec");
        expect(execCall.result).toContain("Blocked");
        // clawd.exec should NOT have been called
        expect(clawd.execCalls.length).toBe(0);
    });
    it("low credits forces low-compute mode", async () => {
        clawd.creditsCents = 50; // Below $1 threshold -> critical
        const inference = new MockInferenceClient([
            noToolResponse("Low on credits."),
        ]);
        await runAgentLoop({
            identity,
            config,
            db,
            clawd,
            inference,
        });
        expect(inference.lowComputeMode).toBe(true);
    });
    it("sleep tool transitions state", async () => {
        const inference = new MockInferenceClient([
            toolCallResponse([
                { name: "sleep", arguments: { duration_seconds: 60, reason: "test" } },
            ]),
        ]);
        await runAgentLoop({
            identity,
            config,
            db,
            clawd,
            inference,
        });
        expect(db.getAgentState()).toBe("sleeping");
        expect(db.getKV("sleep_until")).toBeDefined();
    });
    it("idle auto-sleep on no tool calls", async () => {
        const inference = new MockInferenceClient([
            noToolResponse("Nothing to do."),
        ]);
        await runAgentLoop({
            identity,
            config,
            db,
            clawd,
            inference,
        });
        expect(db.getAgentState()).toBe("sleeping");
    });
    it("inbox messages cause pendingInput injection", async () => {
        // Insert an inbox message before running the loop
        db.insertInboxMessage({
            id: "test-msg-1",
            from: "0xsender",
            to: "0xrecipient",
            content: "Hello from another agent!",
            signedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        });
        const inference = new MockInferenceClient([
            // First response: wakeup prompt
            toolCallResponse([
                { name: "exec", arguments: { command: "echo awake" } },
            ]),
            // Second response: inbox message (after wakeup turn, pendingInput is cleared,
            // then inbox messages are picked up on the next iteration)
            noToolResponse("Received the message."),
        ]);
        const turns = [];
        await runAgentLoop({
            identity,
            config,
            db,
            clawd,
            inference,
            onTurnComplete: (turn) => turns.push(turn),
        });
        // One of the turns should have input from the inbox message
        const inboxTurn = turns.find((t) => t.input?.includes("Hello from another agent!"));
        expect(inboxTurn).toBeDefined();
        expect(inboxTurn.inputSource).toBe("agent");
    });
});
//# sourceMappingURL=loop.test.js.map