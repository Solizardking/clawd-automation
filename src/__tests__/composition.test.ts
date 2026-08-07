/**
 * Composition graph tests: survival imported by loop/heartbeat paths;
 * agent loop applies survival package side effects.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runAgentLoop } from "../agent/loop.js";
import { BUILTIN_TASKS } from "../heartbeat/tasks.js";
import {
  MockInferenceClient,
  MockClawdClient,
  createTestDb,
  createTestIdentity,
  createTestConfig,
  noToolResponse,
} from "./mocks.js";
import { createRuntimeContext } from "../runtime/context.js";
import type { AutomatonDatabase } from "../types.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const srcRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

describe("Composition graph structure", () => {
  it("agent loop source imports survival package", () => {
    const loopSrc = fs.readFileSync(
      path.join(srcRoot, "agent", "loop.ts"),
      "utf-8",
    );
    expect(loopSrc).toMatch(/from ["']\.\.\/survival\/low-compute\.js["']/);
    expect(loopSrc).toMatch(/from ["']\.\.\/survival\/funding\.js["']/);
    expect(loopSrc).toMatch(/applyTierRestrictions/);
    expect(loopSrc).toMatch(/executeFundingStrategies/);
  });

  it("heartbeat tasks import survival monitor", () => {
    const tasksSrc = fs.readFileSync(
      path.join(srcRoot, "heartbeat", "tasks.ts"),
      "utf-8",
    );
    expect(tasksSrc).toMatch(/from ["']\.\.\/survival\/monitor\.js["']/);
    expect(tasksSrc).toMatch(/checkResources/);
    expect(tasksSrc).toMatch(/executeFundingStrategies/);
  });

  it("primary index composes runtime context, CJS bridge, and ZK", () => {
    const indexSrc = fs.readFileSync(path.join(srcRoot, "index.ts"), "utf-8");
    expect(indexSrc).toMatch(/from ["']\.\/runtime\/context\.js["']/);
    expect(indexSrc).toMatch(/from ["']\.\/interop\/cjs-bridge\.js["']/);
    expect(indexSrc).toMatch(/from ["']\.\/zk\/primitives\.js["']/);
    expect(indexSrc).toMatch(/createRuntimeContext/);
    expect(indexSrc).toMatch(/getCjsHealth/);
    expect(indexSrc).toMatch(/getZkHealth/);
    expect(indexSrc).toMatch(/tools: runtime\.tools/);
  });

  it("tools register interop CJS bridge and ZK tools", () => {
    const toolsSrc = fs.readFileSync(
      path.join(srcRoot, "agent", "tools.ts"),
      "utf-8",
    );
    expect(toolsSrc).toMatch(/cjs_capability/);
    expect(toolsSrc).toMatch(/interop\/cjs-bridge/);
    expect(toolsSrc).toMatch(/constitution_context/);
    expect(toolsSrc).toMatch(/lobster_council/);
    expect(toolsSrc).toMatch(/ooda_health/);
    expect(toolsSrc).toMatch(/ooda_run/);
    expect(toolsSrc).toMatch(/ooda_decide/);
    expect(toolsSrc).toMatch(/ooda_journal/);
    expect(toolsSrc).toMatch(/zk_health/);
    expect(toolsSrc).toMatch(/zk_catalog/);
  });

  it("cjs-bridge registers lobster_council capability", () => {
    const bridgeSrc = fs.readFileSync(
      path.join(srcRoot, "interop", "cjs-bridge.ts"),
      "utf-8",
    );
    expect(bridgeSrc).toMatch(/lobster_council/);
    expect(bridgeSrc).toMatch(/lobster-council\.js/);
  });
});

describe("Lobster council + OODA communication", () => {
  it("loads all six lobster-council seats via CJS service", async () => {
    const { invokeCjsCapability, loadCjsCapability } = await import(
      "../interop/cjs-bridge.js"
    );
    const loaded = loadCjsCapability("lobster_council");
    expect(loaded.ok, loaded.error).toBe(true);
    const manifest = invokeCjsCapability("lobster_council", "getManifest", []);
    expect(manifest.ok, manifest.error).toBe(true);
    const m = manifest.result as { present: number; members: Array<{ id: string }> };
    expect(m.present).toBe(6);
    const ids = m.members.map((x) => x.id).sort();
    expect(ids).toEqual(
      [
        "activistpinch",
        "disruptiveshell",
        "latticeclaw",
        "moatmaw",
        "soltoshi",
        "valueclaw",
      ].sort(),
    );
    const sol = invokeCjsCapability("lobster_council", "loadMember", [
      "soltoshi",
    ]);
    expect(sol.ok).toBe(true);
    expect((sol.result as { systemRole: string }).systemRole.length).toBeGreaterThan(
      40,
    );
  });

  it("hedge personas compose with council and include councilRoot", async () => {
    const { invokeCjsCapability } = await import("../interop/cjs-bridge.js");
    const personaManifest = invokeCjsCapability("personas", "getManifest", []);
    expect(personaManifest.ok, personaManifest.error).toBe(true);
    const pm = personaManifest.result as {
      present: number;
      councilRoot: string;
      lobsterCouncil: { present?: number };
    };
    expect(pm.present).toBeGreaterThanOrEqual(5);
    expect(pm.councilRoot).toMatch(/lobster-council/);
    expect(pm.lobsterCouncil?.present).toBe(6);

    const composed = invokeCjsCapability("lobster_council", "composeWithHedge", [
      "valueclaw",
    ]);
    expect(composed.ok).toBe(true);
    const c = composed.result as {
      systemRole: string;
      hedge: { name: string } | null;
    };
    expect(c.systemRole.length).toBeGreaterThan(20);
    expect(c.hedge?.name).toBeTruthy();
  });

  it("ooda bridge resolves harness and CLAWD.md", async () => {
    const {
      getOodaHealth,
      getOodaCatalog,
      getOodaClawdSnippet,
      runPaperTicks,
      oodaDecide,
    } = await import("../ooda/bridge.js");
    const health = getOodaHealth();
    expect(health.ok, health.error).toBe(true);
    expect(health.hasLoop).toBe(true);
    expect(health.hasValidate).toBe(true);
    expect(health.hasClawdMd).toBe(true);
    expect(health.packageName).toBe("@clawd/ooda-harness");
    const cat = getOodaCatalog() as {
      health: { ok: boolean };
      scripts: object;
      tools: string[];
    };
    expect(cat.health.ok).toBe(true);
    expect(cat.scripts).toBeTruthy();
    expect(cat.tools).toContain("ooda_run");
    const snippet = getOodaClawdSnippet(500);
    expect(snippet.length).toBeGreaterThan(20);
    expect(snippet).not.toMatch(/unavailable/);

    // Real paper run through shipped bridge (deterministic, no LLM)
    const paper = await runPaperTicks({ ticks: 3, seed: 7 });
    expect(paper.ok, paper.error).toBe(true);
    expect(paper.results.length).toBe(3);
    expect(paper.mode).toBe("paper");
    expect(paper.network).toBe("devnet");
    for (const r of paper.results) {
      expect(["applied", "rejected"]).toContain(r.outcome);
      expect(Number.isFinite(r.price)).toBe(true);
    }

    const decide = await oodaDecide({
      closes: [1000, 1000, 1000, 1000, 900],
    });
    expect(decide.ok, decide.error).toBe(true);
    expect(decide.decision).toBeTruthy();
    const d = decide.decision as { action: string };
    expect(["hold", "open", "close"]).toContain(d.action);
  });

  it("constitution loader sees laws + root mirror paths", async () => {
    const { invokeCjsCapability } = await import("../interop/cjs-bridge.js");
    const manifest = invokeCjsCapability("constitution", "getManifest", []);
    expect(manifest.ok, manifest.error).toBe(true);
    const m = manifest.result as {
      present: number;
      root: string;
      rootMirror: string;
    };
    expect(m.present).toBeGreaterThanOrEqual(6);
    expect(m.root).toMatch(/constitution/);
    expect(m.rootMirror).toBeTruthy();
    const soul = invokeCjsCapability("constitution", "readDocument", ["soul"]);
    expect(soul.ok).toBe(true);
  });

  it("agent-council exposes lobster briefing", () => {
    const councilPath = path.join(srcRoot, "agents", "agent-council.js");
    const src = fs.readFileSync(councilPath, "utf-8");
    expect(src).toMatch(/lobster-council/);
    expect(src).toMatch(/getLobsterCouncilStatus/);
    expect(src).toMatch(/briefWithLobster/);
  });
});

describe("Loop applies survival package", () => {
  let db: AutomatonDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("low credits applies tier restrictions via survival module", async () => {
    const clawd = new MockClawdClient();
    clawd.creditsCents = 25; // low_compute
    const inference = new MockInferenceClient([
      noToolResponse("Conserving compute."),
    ]);

    const runtime = createRuntimeContext({
      identity: createTestIdentity(),
      config: createTestConfig(),
      db,
      clawd,
      inference,
    });

    await runAgentLoop({
      identity: runtime.identity,
      config: runtime.config,
      db: runtime.db,
      clawd: runtime.clawd,
      inference: runtime.inference,
      tools: runtime.tools,
    });

    expect(inference.lowComputeMode).toBe(true);
    expect(db.getKV("current_tier")).toBe("low_compute");
    // Idle path may sleep after the turn; tier KV proves survival applied
    expect(["low_compute", "sleeping"]).toContain(db.getAgentState());
  });

  it("dead credits stop loop and set dead state", async () => {
    const clawd = new MockClawdClient();
    clawd.creditsCents = 0;
    const inference = new MockInferenceClient([
      noToolResponse("should not run"),
    ]);

    await runAgentLoop({
      identity: createTestIdentity(),
      config: createTestConfig(),
      db,
      clawd,
      inference,
    });

    expect(db.getAgentState()).toBe("dead");
    expect(db.getKV("current_tier")).toBe("dead");
    // No inference chat when dead
    expect(inference.calls.length).toBe(0);
  });
});

describe("Heartbeat check_credits uses survival monitor", () => {
  let db: AutomatonDatabase;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("stores monitor report and funding notices on tier drop", async () => {
    db.setKV("prev_credit_tier", "normal");
    db.setKV("current_tier", "normal");

    const clawd = new MockClawdClient();
    clawd.creditsCents = 5; // critical

    const result = await BUILTIN_TASKS.check_credits({
      identity: createTestIdentity(),
      config: createTestConfig(),
      db,
      clawd,
    });

    expect(result.shouldWake).toBe(true);
    expect(result.message).toMatch(/critical/i);

    const lastCheck = JSON.parse(db.getKV("last_credit_check") || "{}");
    expect(lastCheck.tier).toBe("critical");
    expect(lastCheck.report).toContain("RESOURCE STATUS");
    expect(db.getKV("funding_notice_critical") || db.getKV("tier_transitions")).toBeTruthy();
  });
});
