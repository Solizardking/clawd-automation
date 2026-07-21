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
    expect(toolsSrc).toMatch(/zk_health/);
    expect(toolsSrc).toMatch(/zk_catalog/);
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
