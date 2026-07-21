/**
 * ZK primitives bridge — observer health + catalog against repo tree.
 */

import { describe, it, expect } from "vitest";
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

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

describe("zk-primitives tree", () => {
  it("resolves MANIFEST next to the monorepo root", () => {
    const root = resolveZkPrimitivesRoot();
    expect(root).toBeTruthy();
    expect(fs.existsSync(path.join(root!, "MANIFEST.json"))).toBe(true);
    expect(root).toContain("zk-primitives");
  });

  it("loads manifest with operations and packages", () => {
    const manifest = loadZkManifest();
    expect(manifest).toBeTruthy();
    expect(manifest!.name).toMatch(/ZK/i);
    expect(Array.isArray(manifest!.operations)).toBe(true);
    expect(manifest!.operations!.length).toBeGreaterThan(0);
    expect(manifest!.packages?.program?.programId || manifest!.packages).toBeTruthy();
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
    expect(cat.docs.length).toBeGreaterThan(0);
    expect(cat.trustGate.default || cat.trustGate).toBeTruthy();
  });

  it("prompt context mentions laws and observer trust", () => {
    const text = getZkPromptContext();
    expect(text).toMatch(/ZK/i);
    expect(text).toMatch(/observer/i);
    expect(text).toMatch(/Law/i);
  });

  it("primary tools source registers zk tools", () => {
    const toolsSrc = fs.readFileSync(
      path.join(repoRoot, "src", "agent", "tools.ts"),
      "utf-8",
    );
    expect(toolsSrc).toMatch(/zk_health/);
    expect(toolsSrc).toMatch(/zk_catalog/);
    expect(toolsSrc).toMatch(/zk\/primitives/);
  });

  it("index.ts probes getZkHealth at boot", () => {
    const indexSrc = fs.readFileSync(
      path.join(repoRoot, "src", "index.ts"),
      "utf-8",
    );
    expect(indexSrc).toMatch(/getZkHealth/);
    expect(indexSrc).toMatch(/zk\/primitives/);
  });
});
