/**
 * Clawd-only identity: no retired third-party control-plane product tokens in
 * source, OpenRouter-only inference, local Clawd credits on the shell path.
 */

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClawdClient } from "../shell/client.js";
import { checkFinancialState, getSurvivalTier, formatCredits } from "../shell/credits.js";
import {
  resolveInferenceBackend,
  resolveInferenceClient,
} from "../inference/resolve.js";
import { createBuiltinTools, executeTool } from "../agent/tools.js";
import type { ToolContext } from "../types.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/** Split so this file itself never embeds the banned product substring. */
const BANNED = ["c", "onw", "ay"].concat();

const SKIP_DIR = new Set([
  "node_modules",
  "target",
  ".git",
  "dist",
  ".pack-evidence",
]);

const TEXT_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".rs",
  ".toml",
  ".yml",
  ".yaml",
  ".txt",
  ".sh",
]);

function walkFiles(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".") && ent.name !== ".env.example") {
      // still scan .npmignore / env example if present
      if (
        ![".npmignore", ".gitignore", ".env.example", ".markdownlint.json", ".markdownlint-cli2.jsonc"].includes(
          ent.name,
        )
      ) {
        if (ent.isDirectory()) continue;
      }
    }
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR.has(ent.name)) continue;
      walkFiles(full, out);
      continue;
    }
    if (ent.name.endsWith(".tgz")) continue;
    if (ent.name === "package-lock.json" || ent.name === "pnpm-lock.yaml") continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!TEXT_EXT.has(ext) && ![".npmignore", "LICENSE"].includes(ent.name)) continue;
    out.push(full);
  }
  return out;
}

describe("repo identity: no banned control-plane product token", () => {
  it("source trees do not contain the banned product substring", () => {
    const roots = [
      path.join(repoRoot, "src"),
      path.join(repoRoot, "constitution"),
      path.join(repoRoot, "scripts"),
      path.join(repoRoot, "zk-primitives"),
      path.join(repoRoot, "agent", "src"),
      path.join(repoRoot, "ooda"),
      path.join(repoRoot, "knowledge"),
      path.join(repoRoot, "docs"),
      path.join(repoRoot, "data"),
      path.join(repoRoot, "lobster-council"),
    ];
    const singles = [
      "package.json",
      "pnpm-workspace.yaml",
      "README.md",
      "CLAWD.md",
      "CONSTITUTION.md",
      "IDENTITY.md",
      "SOUL.md",
      "six-laws.md",
      "program.md",
      "vitest.config.ts",
      "tsconfig.json",
    ].map((f) => path.join(repoRoot, f));

    const files: string[] = [...singles.filter((f) => fs.existsSync(f))];
    for (const r of roots) {
      if (fs.existsSync(r)) walkFiles(r, files);
    }

    const hits: Array<{ file: string; line: number; text: string }> = [];
    const re = new RegExp(BANNED, "i");
    for (const file of files) {
      // Skip this test file's string construction is already split; still scan others
      let body: string;
      try {
        body = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const lines = body.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (re.test(line)) {
          hits.push({
            file: path.relative(repoRoot, file),
            line: i + 1,
            text: line.trim().slice(0, 160),
          });
        }
      });
    }

    expect(hits, JSON.stringify(hits, null, 2)).toEqual([]);
  });

  it("package name and bins are Clawd / onchainai only", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    ) as { name: string; bin: Record<string, string> };
    expect(pkg.name).toBe("@onchainai/automation");
    expect(pkg.name.toLowerCase()).not.toContain(BANNED);
    for (const [binName, binPath] of Object.entries(pkg.bin ?? {})) {
      expect(binName.toLowerCase()).not.toContain(BANNED);
      expect(binPath.toLowerCase()).not.toContain(BANNED);
    }
    expect(pkg.bin.automaton).toBe("dist/index.js");
    expect(pkg.bin["clawd-automaton"]).toBe("dist/index.js");
  });
});

describe("Clawd local compute credits", () => {
  const prev = process.env.CLAWD_CREDITS_CENTS;

  afterEach(() => {
    if (prev === undefined) delete process.env.CLAWD_CREDITS_CENTS;
    else process.env.CLAWD_CREDITS_CENTS = prev;
  });

  it("createClawdClient reads CLAWD_CREDITS_CENTS for getCreditsBalance", async () => {
    process.env.CLAWD_CREDITS_CENTS = "4242";
    const clawd = createClawdClient({ sandboxId: "credit-test" });
    const bal = await clawd.getCreditsBalance();
    expect(bal).toBe(4242);
    const fin = await checkFinancialState(clawd, 0);
    expect(fin.creditsCents).toBe(4242);
    expect(formatCredits(4242)).toBe("$42.42");
    expect(getSurvivalTier(4242)).toMatch(/normal|low_compute|critical|dead/);
  });

  it("check_credits tool reports Clawd local balance via real shell client", async () => {
    const clawd = createClawdClient({
      sandboxId: "tool-credit-test",
      creditsCents: 7777,
    });
    const tools = createBuiltinTools("tool-credit-test");
    const ctx = {
      clawd,
      identity: { sandboxId: "tool-credit-test" },
    } as unknown as ToolContext;
    const result = await executeTool("check_credits", {}, tools, ctx);
    expect(result.error).toBeUndefined();
    expect(result.result).toMatch(/7777|\$77\.77/);
  });
});

describe("OpenRouter-only inference resolve", () => {
  it("only openrouter and auto are explicit backends", () => {
    expect(resolveInferenceBackend({ INFERENCE_PROVIDER: "openrouter" } as any)).toBe(
      "openrouter",
    );
    expect(resolveInferenceBackend({ INFERENCE_PROVIDER: "auto" } as any)).toBe(
      "auto",
    );
    expect(resolveInferenceBackend({ INFERENCE_PROVIDER: "other" } as any)).toBe(
      "auto",
    );
  });

  it("resolveInferenceClient is openrouter and errors mention Clawd credits not banned token", () => {
    const resolved = resolveInferenceClient({
      maxTokens: 512,
      env: {
        OPENROUTER_API_KEY: "sk-or-test",
        OPENROUTER_FREE_MODEL: "openrouter/free",
        INFERENCE_PROVIDER: "auto",
      } as any,
    });
    expect(resolved.backend).toBe("openrouter");

    try {
      resolveInferenceClient({
        maxTokens: 1,
        env: { INFERENCE_PROVIDER: "auto" } as any,
      });
      expect.fail("should throw");
    } catch (e: any) {
      const msg = String(e.message);
      expect(msg).toMatch(/OPENROUTER_API_KEY/);
      expect(msg.toLowerCase()).not.toContain(BANNED);
      expect(msg).toMatch(/CLAWD_CREDITS_CENTS|OpenRouter|Clawd/);
    }
  });
});
