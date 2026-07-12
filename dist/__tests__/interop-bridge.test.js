/**
 * CJS interop bridge + cross-package tool dispatch integration tests.
 * Drives real shipped modules (bridge, tools, survival, constitution).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadCjsCapability, invokeCjsCapability, getCjsHealth, listCjsCapabilities, clearCjsBridgeCache, resolveSrcRoot, getCjsSrcRoot, getCapabilityPaths, } from "../interop/cjs-bridge.js";
import { existsSync } from "node:fs";
import path from "node:path";
import { createBuiltinTools, executeTool, } from "../agent/tools.js";
import { createRuntimeContext, toToolContext, toHeartbeatOptions, } from "../runtime/context.js";
import { MockConwayClient, MockInferenceClient, createTestDb, createTestIdentity, createTestConfig, } from "./mocks.js";
describe("CJS interop bridge", () => {
    beforeEach(() => {
        clearCjsBridgeCache();
    });
    it("lists registered capabilities including agents and providers", () => {
        const names = listCjsCapabilities();
        expect(names).toContain("constitution");
        expect(names).toContain("x402_knowledge");
        expect(names).toContain("knowledge");
        expect(names).toContain("personas");
        expect(names).toContain("skillhub");
        expect(names).toContain("config");
        expect(names).toContain("cli_commands");
        expect(names).toContain("agents");
        expect(names).toContain("base_agent");
        expect(names).toContain("providers");
        expect(names).toContain("unified_ai");
    });
    it("loads constitution CJS module and returns real manifest", () => {
        const loaded = loadCjsCapability("constitution");
        expect(loaded.ok).toBe(true);
        expect(loaded.exports).toBeDefined();
        const manifest = invokeCjsCapability("constitution", "getManifest", []);
        expect(manifest.ok).toBe(true);
        const body = manifest.result;
        expect(body.name).toMatch(/Constitution/i);
        expect(body.documentCount).toBeGreaterThan(0);
        expect(body.laws.I).toMatch(/harm/i);
    });
    it("attests on-chain three-laws via real CJS export", () => {
        const attest = invokeCjsCapability("constitution", "attestOnChainLaws", []);
        expect(attest.ok).toBe(true);
        const body = attest.result;
        expect(body.document).toBe("three-laws");
        expect(body.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(body.chars).toBeGreaterThan(0);
    });
    it("loads x402 knowledge prompt context from CJS package", () => {
        const result = invokeCjsCapability("x402_knowledge", "getX402PromptContext", []);
        expect(result.ok).toBe(true);
        const text = String(result.result);
        expect(text.length).toBeGreaterThan(100);
        expect(text.toLowerCase()).toMatch(/x402|solana|payment/);
    });
    it("loads personas list from CJS service", () => {
        const result = invokeCjsCapability("personas", "getManifest", []);
        expect(result.ok).toBe(true);
        const body = result.result;
        // Real module returns a non-empty structured object
        expect(body).toBeTruthy();
        expect(typeof body).toBe("object");
    });
    it("getCjsHealth reports available pure modules", () => {
        const health = getCjsHealth();
        expect(health.srcRoot).toMatch(/src$/);
        expect(health.available).toContain("constitution");
        expect(health.available).toContain("x402_knowledge");
        expect(health.timestamp).toBeTruthy();
    });
    it("loads agents package (agent-council) and invokes getCouncilStatus", () => {
        const loaded = loadCjsCapability("agents");
        expect(loaded.ok).toBe(true);
        expect(loaded.path).toMatch(/agents[/\\]agent-council\.js$/);
        expect(loaded.exports).toBeTruthy();
        const desc = invokeCjsCapability("agents", "__describe", []);
        expect(desc.ok).toBe(true);
        const shape = desc.result;
        expect(shape.kind).toBe("object");
        expect(shape.methods).toContain("getCouncilStatus");
        expect(shape.keys).toEqual(expect.arrayContaining(["agents", "sessions", "votingHistory"]));
        const status = invokeCjsCapability("agents", "getCouncilStatus", []);
        expect(status.ok).toBe(true);
        expect(status.result).toBeTruthy();
        // Real council status is a structured non-empty object
        expect(typeof status.result).toBe("object");
    });
    it("loads base_agent class and constructs a real instance", () => {
        const loaded = loadCjsCapability("base_agent");
        expect(loaded.ok).toBe(true);
        expect(loaded.path).toMatch(/agents[/\\]base-agent\.js$/);
        expect(typeof loaded.exports).toBe("function");
        expect(loaded.exports.name).toBe("BaseAgent");
        const constructed = invokeCjsCapability("base_agent", "construct", [
            "bridge-test",
            "interop",
            ["trade", "research"],
        ]);
        expect(constructed.ok).toBe(true);
        const body = constructed.result;
        expect(body.constructed).toBe(true);
        expect(body.className).toBe("BaseAgent");
        expect(body.name).toBe("bridge-test");
        expect(body.type).toBe("interop");
        expect(body.capabilities).toEqual(["trade", "research"]);
        expect(body.state).toBe("idle");
    });
    it("loads providers package (openrouter) and reads models field", () => {
        const loaded = loadCjsCapability("providers");
        expect(loaded.ok).toBe(true);
        expect(loaded.path).toMatch(/providers[/\\]openrouter\.js$/);
        const models = invokeCjsCapability("providers", "models", []);
        expect(models.ok).toBe(true);
        const map = models.result;
        expect(map).toBeTruthy();
        expect(typeof map).toBe("object");
        // Real OpenRouterProvider.models map has at least one model id string
        const values = Object.values(map);
        expect(values.length).toBeGreaterThan(0);
        expect(typeof values[0]).toBe("string");
        expect(values[0].length).toBeGreaterThan(0);
        const desc = invokeCjsCapability("providers", "__describe", []);
        expect(desc.ok).toBe(true);
        const shape = desc.result;
        expect(shape.methods).toContain("generateCompletion");
    });
    it("loads unified_ai provider and describes export shape", () => {
        const loaded = loadCjsCapability("unified_ai");
        expect(loaded.ok).toBe(true);
        expect(loaded.path).toMatch(/providers[/\\]unified-ai\.js$/);
        const name = invokeCjsCapability("unified_ai", "agentName", []);
        expect(name.ok).toBe(true);
        expect(String(name.result).length).toBeGreaterThan(0);
        const desc = invokeCjsCapability("unified_ai", "__describe", []);
        expect(desc.ok).toBe(true);
        const shape = desc.result;
        expect(shape.kind).toBe("object");
        expect(shape.keys).toEqual(expect.arrayContaining(["openRouter", "cloudflare", "agentName"]));
        expect(shape.methods.length).toBeGreaterThan(0);
    });
    it("resolveSrcRoot finds src/ from a simulated dist/interop layout", () => {
        const repoSrc = getCjsSrcRoot();
        expect(existsSync(path.join(repoSrc, "services", "constitution.js"))).toBe(true);
        // Simulate compiled bridge living at <repo>/dist/interop
        const fakeDistInterop = path.join(path.dirname(repoSrc), "dist", "interop");
        const resolved = resolveSrcRoot(fakeDistInterop);
        expect(resolved).toBe(repoSrc);
        expect(existsSync(path.join(resolved, "providers", "openrouter.js"))).toBe(true);
        expect(existsSync(path.join(resolved, "agents", "agent-council.js"))).toBe(true);
    });
    it("all capability paths point at existing CJS files under SRC_ROOT (not dist/)", () => {
        const paths = getCapabilityPaths();
        const srcRoot = getCjsSrcRoot();
        expect(srcRoot.replace(/\\/g, "/")).toMatch(/\/src$/);
        expect(srcRoot.includes(`${path.sep}dist`)).toBe(false);
        for (const [name, p] of Object.entries(paths)) {
            expect(existsSync(p), `${name} missing at ${p}`).toBe(true);
            expect(p.startsWith(srcRoot), `${name} not under SRC_ROOT`).toBe(true);
            // Must not point into dist/
            expect(p.includes(`${path.sep}dist${path.sep}`)).toBe(false);
        }
    });
    it("CJS config export has openRouter (not ESM Automaton config.ts shape)", () => {
        const loaded = loadCjsCapability("config");
        expect(loaded.ok).toBe(true);
        const cfg = loaded.exports;
        // CJS product config — distinct from AutomatonConfig in config.ts
        expect(cfg.openRouter).toBeDefined();
        expect(cfg.openRouter?.models).toBeDefined();
        expect(cfg.product?.name).toBeTruthy();
        // Must not look like AutomatonConfig (no conwayApiUrl on product config root)
        expect(cfg.conwayApiUrl).toBeUndefined();
    });
});
describe("Shared runtime context", () => {
    let db;
    beforeEach(() => {
        db = createTestDb();
    });
    afterEach(() => {
        db.close();
    });
    it("creates one shared bag with tools and same object refs", () => {
        const identity = createTestIdentity();
        const config = createTestConfig();
        const conway = new MockConwayClient();
        const inference = new MockInferenceClient();
        const runtime = createRuntimeContext({
            identity,
            config,
            db,
            conway,
            inference,
            skills: [],
        });
        expect(runtime.identity).toBe(identity);
        expect(runtime.db).toBe(db);
        expect(runtime.conway).toBe(conway);
        expect(runtime.inference).toBe(inference);
        expect(runtime.tools.length).toBeGreaterThan(10);
        expect(runtime.tools.some((t) => t.name === "cjs_capability")).toBe(true);
        expect(runtime.tools.some((t) => t.name === "exec")).toBe(true);
        const toolCtx = toToolContext(runtime);
        expect(toolCtx.db).toBe(db);
        expect(toolCtx.conway).toBe(conway);
        const hb = toHeartbeatOptions(runtime);
        expect(hb.db).toBe(db);
        expect(hb.identity).toBe(identity);
    });
});
describe("Cross-package tool dispatch", () => {
    let db;
    beforeEach(() => {
        clearCjsBridgeCache();
        db = createTestDb();
    });
    afterEach(() => {
        db.close();
    });
    it("executeTool(cjs_capability) loads constitution via bridge", async () => {
        const identity = createTestIdentity();
        const runtime = createRuntimeContext({
            identity,
            config: createTestConfig(),
            db,
            conway: new MockConwayClient(),
            inference: new MockInferenceClient(),
        });
        const ctx = toToolContext(runtime);
        const result = await executeTool("cjs_capability", { name: "constitution", method: "getManifest" }, runtime.tools, ctx);
        expect(result.error).toBeUndefined();
        expect(result.name).toBe("cjs_capability");
        const parsed = JSON.parse(result.result);
        expect(parsed.name).toMatch(/Constitution/i);
        expect(parsed.documentCount).toBeGreaterThan(0);
    });
    it("executeTool(constitution_context) returns non-stub payload", async () => {
        const runtime = createRuntimeContext({
            identity: createTestIdentity(),
            config: createTestConfig(),
            db,
            conway: new MockConwayClient(),
            inference: new MockInferenceClient(),
        });
        const result = await executeTool("constitution_context", {}, runtime.tools, toToolContext(runtime));
        expect(result.error).toBeUndefined();
        expect(result.result.length).toBeGreaterThan(20);
        // Either full prompt text or JSON fallback with manifest
        expect(result.result.includes("Law") ||
            result.result.includes("manifest") ||
            result.result.includes("Constitution") ||
            result.result.includes("three-laws")).toBe(true);
    });
    it("executeTool(x402_knowledge) returns real knowledge text", async () => {
        const runtime = createRuntimeContext({
            identity: createTestIdentity(),
            config: createTestConfig(),
            db,
            conway: new MockConwayClient(),
            inference: new MockInferenceClient(),
        });
        const result = await executeTool("x402_knowledge", {}, runtime.tools, toToolContext(runtime));
        expect(result.error).toBeUndefined();
        expect(result.result.toLowerCase()).toMatch(/x402|solana|payment/);
    });
    it("executeTool(check_credits) hits shared conway client", async () => {
        const conway = new MockConwayClient();
        conway.creditsCents = 1234;
        const tools = createBuiltinTools("test-sandbox-id");
        const ctx = {
            identity: createTestIdentity(),
            config: createTestConfig(),
            db,
            conway,
            inference: new MockInferenceClient(),
        };
        const result = await executeTool("check_credits", {}, tools, ctx);
        expect(result.error).toBeUndefined();
        expect(result.result).toContain("1234");
        expect(result.result).toMatch(/\$12\.34/);
    });
    it("executeTool(cjs_capability) loads agents package on primary tool path", async () => {
        const runtime = createRuntimeContext({
            identity: createTestIdentity(),
            config: createTestConfig(),
            db,
            conway: new MockConwayClient(),
            inference: new MockInferenceClient(),
        });
        const result = await executeTool("cjs_capability", { name: "agents", method: "getCouncilStatus" }, runtime.tools, toToolContext(runtime));
        expect(result.error).toBeUndefined();
        expect(result.result.length).toBeGreaterThan(2);
        // Must not be a stub string — real council status serializes as JSON object
        const parsed = JSON.parse(result.result);
        expect(parsed).toBeTruthy();
        expect(typeof parsed).toBe("object");
    });
    it("executeTool(cjs_capability) loads providers package on primary tool path", async () => {
        const runtime = createRuntimeContext({
            identity: createTestIdentity(),
            config: createTestConfig(),
            db,
            conway: new MockConwayClient(),
            inference: new MockInferenceClient(),
        });
        const result = await executeTool("cjs_capability", { name: "providers", method: "models" }, runtime.tools, toToolContext(runtime));
        expect(result.error).toBeUndefined();
        const parsed = JSON.parse(result.result);
        expect(typeof parsed).toBe("object");
        expect(Object.keys(parsed).length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=interop-bridge.test.js.map