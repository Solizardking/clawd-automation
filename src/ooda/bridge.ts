/**
 * OODA harness bridge — connects repo-root `ooda/` into the ESM runtime graph.
 *
 * Does not execute live trading loops by default. Exposes discovery/health so
 * the automaton, packaging, and composition tests can assert the harness is
 * present and communicates with constitution/council docs.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface OodaHealth {
  ok: boolean;
  root: string | null;
  packageName: string | null;
  packageVersion: string | null;
  entries: string[];
  hasLoop: boolean;
  hasValidate: boolean;
  hasClawdMd: boolean;
  hasGoblinMd: boolean;
  hasJournalDir: boolean;
  error?: string;
  timestamp: string;
}

/**
 * Resolve `ooda/` from dist/ or src/ locations.
 */
export function resolveOodaRoot(fromDir: string = __dirname): string | null {
  const candidates = [
    // src/ooda → ../../ooda
    path.resolve(fromDir, "..", "..", "ooda"),
    // dist/ooda → ../../ooda
    path.resolve(fromDir, "..", "..", "ooda"),
    // cwd
    path.resolve(process.cwd(), "ooda"),
    // nested install under package root
    path.resolve(fromDir, "..", "..", "..", "ooda"),
  ];

  for (const c of candidates) {
    if (existsSync(path.join(c, "package.json")) && existsSync(path.join(c, "loop.ts"))) {
      return c;
    }
  }
  return null;
}

export function getOodaHealth(): OodaHealth {
  const timestamp = new Date().toISOString();
  const root = resolveOodaRoot();
  if (!root) {
    return {
      ok: false,
      root: null,
      packageName: null,
      packageVersion: null,
      entries: [],
      hasLoop: false,
      hasValidate: false,
      hasClawdMd: false,
      hasGoblinMd: false,
      hasJournalDir: false,
      error: "ooda/ package not found relative to runtime",
      timestamp,
    };
  }

  let packageName: string | null = null;
  let packageVersion: string | null = null;
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      name?: string;
      version?: string;
    };
    packageName = pkg.name ?? null;
    packageVersion = pkg.version ?? null;
  } catch {
    /* ignore */
  }

  const entries = readdirSync(root).filter((n) => !n.startsWith(".") && n !== "node_modules");

  return {
    ok: true,
    root,
    packageName,
    packageVersion,
    entries,
    hasLoop: existsSync(path.join(root, "loop.ts")),
    hasValidate: existsSync(path.join(root, "validate.ts")),
    hasClawdMd: existsSync(path.join(root, "CLAWD.md")),
    hasGoblinMd: existsSync(path.join(root, "goblin.md")),
    hasJournalDir: existsSync(path.join(root, "journal")),
    timestamp,
  };
}

/**
 * Read ooda/CLAWD.md frontmatter-ish body for prompt injection (observer only).
 */
export function getOodaClawdSnippet(maxChars = 2000): string {
  const root = resolveOodaRoot();
  if (!root) return "[ooda CLAWD.md unavailable]";
  const fp = path.join(root, "CLAWD.md");
  if (!existsSync(fp)) return "[ooda CLAWD.md missing]";
  let text = readFileSync(fp, "utf8");
  if (text.length > maxChars) text = text.slice(0, maxChars) + "\n\n[…ooda CLAWD truncated…]";
  return text;
}

/**
 * Structural catalog of ooda sources for tools/docs.
 */
export function getOodaCatalog(): Record<string, unknown> {
  const health = getOodaHealth();
  if (!health.ok || !health.root) return { health };
  const files: Array<{ name: string; bytes: number }> = [];
  for (const name of health.entries) {
    const fp = path.join(health.root, name);
    try {
      const st = statSync(fp);
      if (st.isFile()) files.push({ name, bytes: st.size });
    } catch {
      /* skip */
    }
  }
  return {
    health,
    files,
    scripts: {
      loop: "npm run loop --prefix ooda",
      tui: "npm run tui --prefix ooda",
      lint: "npm run lint --prefix ooda",
    },
    safety: "paper/devnet only — mainnet rejected in observe.ts",
  };
}
