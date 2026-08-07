/**
 * Packaging + CLI surface tests.
 * Drives the real entry (dist/index.js when built, else src via process spawn of node on built bin).
 * Asserts version sync, shebang, files allowlist, and runtime path roots used after npm install.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { resolveSrcRoot } from "../interop/cjs-bridge.js";
import { resolveZkPrimitivesRoot, getZkHealth } from "../zk/primitives.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const pkg = require(path.join(ROOT, "package.json")) as {
  name: string;
  version: string;
  bin: Record<string, string>;
  files: string[];
  publishConfig?: { access?: string };
};

function runBin(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const entry = path.join(ROOT, "dist", "index.js");
  expect(existsSync(entry)).toBe(true);
  const r = spawnSync(process.execPath, [entry, ...args], {
    encoding: "utf8",
    cwd: ROOT,
    env: process.env,
  });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

describe("package metadata for npm publish", () => {
  it("is scoped @onchainai/automation with public publishConfig", () => {
    expect(pkg.name).toBe("@onchainai/automation");
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(pkg.publishConfig?.access).toBe("public");
  });

  it("exposes automaton and clawd-automaton bins to dist/index.js", () => {
    expect(pkg.bin.automaton).toBe("dist/index.js");
    expect(pkg.bin["clawd-automaton"]).toBe("dist/index.js");
  });

  it("files allowlist ships dist, CJS surface, constitution, ZK health roots", () => {
    const files = pkg.files ?? [];
    const required = [
      "dist",
      "src/services",
      "constitution",
      "zk-primitives/MANIFEST.json",
      "zk-primitives/client/package.json",
      "zk-primitives/agent/package.json",
      "LICENSE",
      "README.md",
    ];
    for (const f of required) {
      expect(files, `files missing ${f}`).toContain(f);
    }
    // paths must exist on disk so pack actually includes them
    for (const f of required) {
      const abs = path.join(ROOT, f);
      expect(existsSync(abs), `missing on disk: ${f}`).toBe(true);
    }
  });
});

describe("shipped CLI entry", () => {
  it("dist/index.js has shebang and is executable", () => {
    const entry = path.join(ROOT, "dist", "index.js");
    expect(existsSync(entry)).toBe(true);
    const head = readFileSync(entry, "utf8").slice(0, 32);
    expect(head.startsWith("#!/usr/bin/env node")).toBe(true);
    const mode = statSync(entry).mode & 0o111;
    expect(mode).toBeGreaterThan(0);
  });

  it("--version prints Clawd Automaton and package.json semver", () => {
    const { status, stdout } = runBin(["--version"]);
    expect(status).toBe(0);
    expect(stdout).toContain("Clawd Automaton");
    expect(stdout).toContain(`v${pkg.version}`);
  });

  it("--help is non-empty and mentions --run / --setup", () => {
    const { status, stdout } = runBin(["--help"]);
    expect(status).toBe(0);
    expect(stdout.trim().length).toBeGreaterThan(40);
    expect(stdout).toMatch(/--run/);
    expect(stdout).toMatch(/--setup/);
    expect(stdout).toContain("Clawd Automaton");
  });
});

describe("runtime roots after install layout", () => {
  it("CJS bridge resolves services/constitution.js under src/", () => {
    const srcRoot = resolveSrcRoot(path.join(ROOT, "dist", "interop"));
    expect(
      existsSync(path.join(srcRoot, "services", "constitution.js")),
    ).toBe(true);
  });

  it("ZK MANIFEST resolves from package root", () => {
    const zkRoot = resolveZkPrimitivesRoot(path.join(ROOT, "dist", "zk"));
    expect(zkRoot).toBeTruthy();
    expect(existsSync(path.join(zkRoot!, "MANIFEST.json"))).toBe(true);
    const health = getZkHealth();
    expect(health.present.manifest).toBe(true);
  });

  it("constitution docs exist at package-root constitution/", () => {
    const c = path.join(ROOT, "constitution");
    expect(existsSync(path.join(c, "CONSTITUTION.md"))).toBe(true);
    const names = readdirSync(c);
    expect(names.length).toBeGreaterThan(3);
  });
});
