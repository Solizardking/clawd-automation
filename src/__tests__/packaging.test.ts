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

  it("files allowlist ships dist, CJS surface, constitution, council, ooda, ZK", () => {
    const files = pkg.files ?? [];
    const required = [
      "dist",
      "src/services",
      "constitution",
      "lobster-council",
      "data/hedge",
      "ooda",
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
    // council seats + ooda loop must be present
    for (const seat of [
      "soltoshi.json",
      "valueclaw.json",
      "latticeclaw.json",
      "moatmaw.json",
      "activistpinch.json",
      "disruptiveshell.json",
    ]) {
      expect(existsSync(path.join(ROOT, "lobster-council", seat)), seat).toBe(
        true,
      );
    }
    expect(existsSync(path.join(ROOT, "ooda", "loop.ts"))).toBe(true);
    expect(existsSync(path.join(ROOT, "src", "services", "lobster-council.js"))).toBe(
      true,
    );
  });

  it(".npmignore excludes maps, tests, env, and tarballs", () => {
    const ignorePath = path.join(ROOT, ".npmignore");
    expect(existsSync(ignorePath)).toBe(true);
    const body = readFileSync(ignorePath, "utf8");
    expect(body).toMatch(/\.map/);
    expect(body).toMatch(/__tests__/);
    expect(body).toMatch(/\.env/);
    expect(body).toMatch(/\*\.tgz/);
  });

  it("npm pack dry-run omits source maps and tests; includes CLI entry", () => {
    // postbuild must have written dist/.npmignore for nested map exclusion
    expect(existsSync(path.join(ROOT, "dist", ".npmignore"))).toBe(true);

    const r = spawnSync("npm", ["pack", "--dry-run"], {
      encoding: "utf8",
      cwd: ROOT,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    });
    expect(r.status, r.stderr || r.stdout).toBe(0);
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    // npm prints "npm notice path" lines for each packed file
    expect(out).toMatch(/dist\/index\.js/);
    expect(out).toMatch(/src\/services\/constitution\.js/);
    expect(out).toMatch(/constitution\//);
    // Exclusions driven by .npmignore / dist/.npmignore
    expect(out).not.toMatch(/\.js\.map\b/);
    expect(out).not.toMatch(/\.d\.ts\.map\b/);
    expect(out).not.toMatch(/__tests__/);
    expect(out).not.toMatch(/(^|\s)\.env(\s|$)/);
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

  it("constitution bundle is complete and loadable via dist CJS bridge", async () => {
    const required = [
      "CONSTITUTION.md",
      "IDENTITY.md",
      "program.md",
      "README.md",
      "six-laws.md",
      "SOUL.md",
      "strategy.md",
      "three-laws.md",
    ];
    const cdir = path.join(ROOT, "constitution");
    for (const f of required) {
      expect(existsSync(path.join(cdir, f)), `missing constitution/${f}`).toBe(
        true,
      );
    }

    // Drive the real shipped interop entry (compiled dist)
    const bridge = await import(
      path.join(ROOT, "dist", "interop", "cjs-bridge.js")
    );
    const loaded = bridge.loadCjsCapability("constitution");
    expect(loaded.ok, loaded.error).toBe(true);
    expect(loaded.path).toMatch(/constitution\.js$/);

    const inv = bridge.invokeCjsCapability(
      "constitution",
      "listDocuments",
      [],
    );
    expect(inv.ok, inv.error).toBe(true);
    const docs = inv.result as Array<{ id: string; exists: boolean; file: string }>;
    expect(Array.isArray(docs)).toBe(true);
    expect(docs.length).toBeGreaterThanOrEqual(8);
    for (const d of docs) {
      expect(d.exists, `${d.id} missing on disk`).toBe(true);
    }

    const ctx = bridge.invokeCjsCapability("constitution", "getPromptContext", [
      { maxChars: 4000 },
    ]);
    expect(ctx.ok, ctx.error).toBe(true);
    expect(String(ctx.result).toLowerCase()).toMatch(/never harm|law i/);

    const attest = bridge.invokeCjsCapability(
      "constitution",
      "attestOnChainLaws",
      [],
    );
    expect(attest.ok, attest.error).toBe(true);
    const body = attest.result as { sha256?: string; document?: string };
    expect(body.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(body.document).toBe("three-laws");
  });
});
