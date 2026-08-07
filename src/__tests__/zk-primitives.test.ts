/**
 * ZK primitives bridge — observer health + catalog against repo tree.
 * Drives shipped resolve/load/health/catalog helpers and live tool execute paths.
 */

import { afterEach, describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import {
  resolveZkPrimitivesRoot,
  loadZkManifest,
  getZkHealth,
  getZkCatalog,
  getZkPromptContext,
} from "../zk/primitives.js";
import { createBuiltinTools, executeTool } from "../agent/tools.js";
import type { ToolContext } from "../types.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const ENV_KEYS = [
  "CLAWDBOT_ZK_PRIMITIVES_DIR",
  "CLAWD_ZK_PRIMITIVES_DIR",
] as const;

const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> =
  {};

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (key in savedEnv) {
      const v = savedEnv[key];
      if (v === undefined) delete process.env[key];
      else process.env[key] = v;
      delete savedEnv[key];
    }
  }
});

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (!(key in savedEnv)) savedEnv[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

/** Minimal ToolContext — zk tools ignore it. */
function emptyToolCtx(): ToolContext {
  return {} as ToolContext;
}

describe("zk-primitives tree", () => {
  it("resolves MANIFEST next to the monorepo root", () => {
    const root = resolveZkPrimitivesRoot();
    expect(root).toBeTruthy();
    expect(fs.existsSync(path.join(root!, "MANIFEST.json"))).toBe(true);
    expect(root).toContain("zk-primitives");
  });

  it("resolves from dist/zk layout path", () => {
    const fromDist = resolveZkPrimitivesRoot(
      path.join(repoRoot, "dist", "zk"),
    );
    expect(fromDist).toBeTruthy();
    expect(fromDist).toContain("zk-primitives");
    expect(fs.existsSync(path.join(fromDist!, "MANIFEST.json"))).toBe(true);
  });

  it("respects CLAWDBOT_ZK_PRIMITIVES_DIR override over sibling path", () => {
    const realRoot = path.join(repoRoot, "zk-primitives");
    setEnv("CLAWDBOT_ZK_PRIMITIVES_DIR", realRoot);
    // fromDir deliberately wrong — env must still win
    const resolved = resolveZkPrimitivesRoot(path.join(repoRoot, "nope", "zk"));
    expect(resolved).toBe(realRoot);
  });

  it("loads manifest with operations and packages", () => {
    const manifest = loadZkManifest();
    expect(manifest).toBeTruthy();
    expect(manifest!.name).toMatch(/ZK/i);
    expect(Array.isArray(manifest!.operations)).toBe(true);
    expect(manifest!.operations!.length).toBeGreaterThan(0);
    expect(manifest!.operations).toContain("publish_attestation");
    expect(manifest!.packages?.program?.programId).toMatch(/CLAWDzk/);
  });

  it("getZkHealth reports present client/agent/programs", () => {
    const health = getZkHealth();
    expect(health.root).toBeTruthy();
    expect(health.present.manifest).toBe(true);
    expect(health.present.client).toBe(true);
    expect(health.present.agent).toBe(true);
    expect(health.present.programs).toBe(true);
    expect(health.present.zkMd).toBe(true);
    expect(health.ok).toBe(true);
    expect(health.operations).toContain("publish_attestation");
    expect(health.programId).toMatch(/CLAWDzk|1111/);
  });

  it("getZkCatalog exposes trust gates and docs", () => {
    const cat = getZkCatalog();
    expect(cat.name.length).toBeGreaterThan(3);
    expect(cat.operations.length).toBeGreaterThan(0);
    expect(cat.operations).toContain("publish_attestation");
    expect(cat.docs.length).toBeGreaterThan(0);
    expect(cat.trustGate.default).toBe("observer");
    expect(cat.programId).toMatch(/CLAWDzk/);
  });

  it("prompt context mentions laws and observer trust", () => {
    const text = getZkPromptContext();
    expect(text).toMatch(/ZK/i);
    expect(text).toMatch(/observer/i);
    expect(text).toMatch(/Law/i);
  });

  it("primary tools source registers zk tools against real helpers", () => {
    const toolsSrc = fs.readFileSync(
      path.join(repoRoot, "src", "agent", "tools.ts"),
      "utf-8",
    );
    expect(toolsSrc).toMatch(/zk_health/);
    expect(toolsSrc).toMatch(/zk_catalog/);
    expect(toolsSrc).toMatch(/zk\/primitives/);
    expect(toolsSrc).toMatch(/getZkHealth/);
    expect(toolsSrc).toMatch(/getZkCatalog/);
    expect(toolsSrc).toMatch(/getZkPromptContext/);
  });

  it("index.ts probes getZkHealth at boot", () => {
    const indexSrc = fs.readFileSync(
      path.join(repoRoot, "src", "index.ts"),
      "utf-8",
    );
    expect(indexSrc).toMatch(/getZkHealth/);
    expect(indexSrc).toMatch(/zk\/primitives/);
  });

  it("createBuiltinTools registers zk_health and zk_catalog on the primary surface", () => {
    const tools = createBuiltinTools("zk-test-sandbox");
    const names = tools.map((t) => t.name);
    expect(names).toContain("zk_health");
    expect(names).toContain("zk_catalog");
  });

  it("executeTool(zk_health) returns real getZkHealth JSON", async () => {
    const tools = createBuiltinTools("zk-test-sandbox");
    const result = await executeTool("zk_health", {}, tools, emptyToolCtx());
    expect(result.error).toBeUndefined();
    const health = JSON.parse(result.result);
    expect(health.ok).toBe(true);
    expect(String(health.root)).toContain("zk-primitives");
    expect(health.present.manifest).toBe(true);
    expect(health.present.client).toBe(true);
    expect(health.present.agent).toBe(true);
    expect(health.operations).toContain("publish_attestation");
    expect(String(health.programId)).toMatch(/CLAWDzk/);
  });

  it("executeTool(zk_catalog) returns catalog and prompt from shipped helpers", async () => {
    const tools = createBuiltinTools("zk-test-sandbox");
    const jsonResult = await executeTool(
      "zk_catalog",
      {},
      tools,
      emptyToolCtx(),
    );
    expect(jsonResult.error).toBeUndefined();
    const cat = JSON.parse(jsonResult.result);
    expect(cat.operations).toContain("publish_attestation");
    expect(cat.trustGate.default).toBe("observer");
    expect(cat.docs.length).toBeGreaterThan(0);
    expect(String(cat.programId)).toMatch(/CLAWDzk/);

    const promptResult = await executeTool(
      "zk_catalog",
      { as_prompt: true },
      tools,
      emptyToolCtx(),
    );
    expect(promptResult.error).toBeUndefined();
    expect(promptResult.result).toMatch(/observer/i);
    expect(promptResult.result).toMatch(/ZK/i);
    expect(promptResult.result).toMatch(/Law/i);
  });
});
