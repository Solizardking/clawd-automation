/**
 * OODA harness bridge — connects repo-root `ooda/` into the ESM runtime graph.
 *
 * Paper/devnet only. Exposes health, catalog, journal read, deterministic
 * decisions, and short in-process paper tick runs for agent tools.
 * Lineage: integrated with Dark Clawd / on-chain-ai-kit automaton surfaces.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

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
  hasTests: boolean;
  error?: string;
  timestamp: string;
}

export interface PaperTickResult {
  tick: number;
  price: number;
  decision: unknown;
  outcome: "applied" | "rejected";
  violation?: string;
  pnl_lamports?: number;
  cash_lamports: number;
  positions: number;
  consecutive_losses: number;
  total_pnl_lamports: number;
}

export interface PaperRunResult {
  ok: boolean;
  ticks: number;
  seed: number;
  mode: "paper";
  network: "devnet";
  results: PaperTickResult[];
  final: {
    cash_lamports: number;
    total_pnl_lamports: number;
    total_trades: number;
    open_positions: number;
    consecutive_losses: number;
  };
  error?: string;
}

/**
 * Resolve `ooda/` from dist/ or src/ locations.
 */
export function resolveOodaRoot(fromDir: string = __dirname): string | null {
  const candidates = [
    path.resolve(fromDir, "..", "..", "ooda"),
    path.resolve(process.cwd(), "ooda"),
    path.resolve(fromDir, "..", "..", "..", "ooda"),
  ];

  for (const c of candidates) {
    if (
      existsSync(path.join(c, "package.json")) &&
      existsSync(path.join(c, "loop.ts"))
    ) {
      return c;
    }
  }
  return null;
}

function importOodaModule(root: string, file: string): Promise<Record<string, unknown>> {
  // Prefer .ts via path URL so tsx/runtime can load; compiled consumers use dynamic import of source.
  const tsPath = path.join(root, `${file}.ts`);
  const jsPath = path.join(root, `${file}.js`);
  const target = existsSync(tsPath) ? tsPath : jsPath;
  return import(pathToFileURL(target).href) as Promise<Record<string, unknown>>;
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
      hasTests: false,
      error: "ooda/ package not found relative to runtime",
      timestamp,
    };
  }

  let packageName: string | null = null;
  let packageVersion: string | null = null;
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { name?: string; version?: string };
    packageName = pkg.name ?? null;
    packageVersion = pkg.version ?? null;
  } catch {
    /* ignore */
  }

  const entries = readdirSync(root).filter(
    (n) => !n.startsWith(".") && n !== "node_modules",
  );

  const hasLoop = existsSync(path.join(root, "loop.ts"));
  const hasValidate = existsSync(path.join(root, "validate.ts"));
  const hasClawdMd = existsSync(path.join(root, "CLAWD.md"));
  const hasGoblinMd = existsSync(path.join(root, "goblin.md"));
  const hasJournalDir = existsSync(path.join(root, "journal"));
  const hasTests = existsSync(path.join(root, "test"));

  // Healthy only when core harness surfaces exist (paper loop + validate + CLAWD + journal).
  const ok =
    hasLoop &&
    hasValidate &&
    hasClawdMd &&
    hasJournalDir &&
    typeof packageName === "string" &&
    packageName.length > 0;

  return {
    ok,
    root,
    packageName,
    packageVersion,
    entries,
    hasLoop,
    hasValidate,
    hasClawdMd,
    hasGoblinMd,
    hasJournalDir,
    hasTests,
    ...(ok
      ? {}
      : {
          error:
            "ooda/ present but incomplete (need loop.ts, validate.ts, CLAWD.md, journal/, package name)",
        }),
    timestamp,
  };
}

export function getOodaClawdSnippet(maxChars = 2000): string {
  const root = resolveOodaRoot();
  if (!root) return "[ooda CLAWD.md unavailable]";
  const fp = path.join(root, "CLAWD.md");
  if (!existsSync(fp)) return "[ooda CLAWD.md missing]";
  let text = readFileSync(fp, "utf8");
  if (text.length > maxChars)
    text = text.slice(0, maxChars) + "\n\n[…ooda CLAWD truncated…]";
  return text;
}

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
    tools: [
      "ooda_health",
      "ooda_run",
      "ooda_decide",
      "ooda_journal",
    ],
    scripts: {
      loop: "npm run loop --prefix ooda",
      tui: "npm run tui --prefix ooda",
      test: "npm test --prefix ooda",
      lint: "npm run lint --prefix ooda",
    },
    safety: "paper/devnet only — mainnet rejected in observe.ts",
    lineage: "dark-clawd automaton + clawd-automation monorepo",
  };
}

/**
 * Run a short deterministic paper OODA cycle in-process (no LLM, no mainnet).
 */
export async function runPaperTicks(options: {
  ticks?: number;
  seed?: number;
}): Promise<PaperRunResult> {
  const root = resolveOodaRoot();
  if (!root) {
    return {
      ok: false,
      ticks: 0,
      seed: options.seed ?? 42,
      mode: "paper",
      network: "devnet",
      results: [],
      final: {
        cash_lamports: 0,
        total_pnl_lamports: 0,
        total_trades: 0,
        open_positions: 0,
        consecutive_losses: 0,
      },
      error: "ooda/ not found",
    };
  }

  const ticks = Math.min(Math.max(options.ticks ?? 5, 1), 50);
  const seed = options.seed ?? 42;

  try {
    const stateMod = await importOodaModule(root, "state");
    const observeMod = await importOodaModule(root, "observe");
    const validateMod = await importOodaModule(root, "validate");
    const decisionMod = await importOodaModule(root, "clawd-decision");

    const createState = stateMod.createState as (cash?: number) => {
      tick: number;
      book: { positions: Array<{ id: string; side: string }>; cash_lamports: number };
      consecutive_losses: number;
      total_pnl_lamports: number;
      total_trades: number;
    };
    const openPosition = stateMod.openPosition as (
      s: ReturnType<typeof createState>,
      side: "long" | "short",
      size: number,
      price: number,
    ) => { id: string };
    const closePosition = stateMod.closePosition as (
      s: ReturnType<typeof createState>,
      id: string,
      price: number,
    ) => number;
    const SynthObserver = observeMod.SynthObserver as new (
      seed?: number,
      start?: number,
      window?: number,
    ) => { tick: (now?: Date) => Array<{ c: number }> };
    const validate = validateMod.validate as (
      raw: unknown,
      config: {
        mode: "paper";
        network: "devnet";
        max_action_per_tick: number;
        max_position_size_lamports: number;
        loss_killswitch_consecutive: number;
      },
      book: ReturnType<typeof createState>["book"],
    ) => {
      ok: boolean;
      decision: {
        action: string;
        side?: "long" | "short";
        size_lamports?: number;
        position_id?: string;
        reason: string;
      };
      violation?: string;
    };
    const parseClawdConfig = validateMod.parseClawdConfig as (
      md: string,
    ) => {
      max_position_size_lamports: number;
      loss_killswitch_consecutive: number;
    };
    const deterministicDecision = decisionMod.deterministicDecision as (
      obs: unknown,
    ) => unknown;

    const clawdMd = readFileSync(path.join(root, "CLAWD.md"), "utf8");
    const config = parseClawdConfig(clawdMd);
    const state = createState();
    const observer = new SynthObserver(seed, 150_000, 20);
    const results: PaperTickResult[] = [];

    for (let tick = 1; tick <= ticks; tick++) {
      state.tick = tick;
      const candles = observer.tick(new Date());
      const currentPrice = candles[candles.length - 1]!.c;
      const obs = {
        tick,
        now: new Date().toISOString(),
        mode: "paper",
        network: "devnet",
        candles: candles.slice(-10),
        book: {
          positions: state.book.positions,
          cash_lamports: state.book.cash_lamports,
        },
        last_decisions: [],
      };
      const raw = deterministicDecision(obs);
      const paperConfig = {
        mode: "paper" as const,
        network: "devnet" as const,
        max_action_per_tick: 1,
        max_position_size_lamports: config.max_position_size_lamports,
        loss_killswitch_consecutive: config.loss_killswitch_consecutive,
      };
      const validation = validate(raw, paperConfig, state.book);
      let outcome: "applied" | "rejected" = "applied";
      let pnl: number | undefined;
      if (!validation.ok) {
        outcome = "rejected";
      } else if (validation.decision.action === "open") {
        openPosition(
          state,
          validation.decision.side!,
          validation.decision.size_lamports!,
          currentPrice,
        );
      } else if (validation.decision.action === "close") {
        pnl = closePosition(
          state,
          validation.decision.position_id!,
          currentPrice,
        );
      }

      results.push({
        tick,
        price: currentPrice,
        decision: validation.decision,
        outcome,
        violation: validation.violation,
        pnl_lamports: pnl,
        cash_lamports: state.book.cash_lamports,
        positions: state.book.positions.length,
        consecutive_losses: state.consecutive_losses,
        total_pnl_lamports: state.total_pnl_lamports,
      });
    }

    return {
      ok: true,
      ticks,
      seed,
      mode: "paper",
      network: "devnet",
      results,
      final: {
        cash_lamports: state.book.cash_lamports,
        total_pnl_lamports: state.total_pnl_lamports,
        total_trades: state.total_trades,
        open_positions: state.book.positions.length,
        consecutive_losses: state.consecutive_losses,
      },
    };
  } catch (err) {
    return {
      ok: false,
      ticks,
      seed,
      mode: "paper",
      network: "devnet",
      results: [],
      final: {
        cash_lamports: 0,
        total_pnl_lamports: 0,
        total_trades: 0,
        open_positions: 0,
        consecutive_losses: 0,
      },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * One-shot deterministic decision for given candle closes (paper only).
 */
export async function oodaDecide(options: {
  closes?: number[];
  positions?: Array<{ id: string; side: string }>;
  cash_lamports?: number;
}): Promise<{ ok: boolean; decision?: unknown; error?: string }> {
  const root = resolveOodaRoot();
  if (!root) return { ok: false, error: "ooda/ not found" };
  try {
    const decisionMod = await importOodaModule(root, "clawd-decision");
    const deterministicDecision = decisionMod.deterministicDecision as (
      obs: unknown,
    ) => unknown;
    const closes = options.closes ?? [150000, 149500, 150200, 151000, 150800];
    const candles = closes.map((c, i) => ({
      t: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      o: c,
      h: c + 100,
      l: c - 100,
      c,
      v: 1_000_000,
    }));
    const decision = deterministicDecision({
      tick: closes.length,
      now: new Date().toISOString(),
      mode: "paper",
      network: "devnet",
      candles,
      book: {
        positions: options.positions ?? [],
        cash_lamports: options.cash_lamports ?? 10_000_000,
      },
      last_decisions: [],
    });
    return { ok: true, decision };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Read last N journal entries from ooda/journal (or OODA_JOURNAL_PATH).
 */
export async function readOodaJournal(n = 5): Promise<{
  ok: boolean;
  path?: string;
  entries?: unknown[];
  error?: string;
}> {
  const root = resolveOodaRoot();
  if (!root) return { ok: false, error: "ooda/ not found" };
  try {
    // Prefer reading file directly so we don't depend on module side effects
    const journalFile =
      process.env["OODA_JOURNAL_PATH"]?.trim() ||
      path.join(root, "journal", "ticks.jsonl");
    if (!existsSync(journalFile)) {
      return { ok: true, path: journalFile, entries: [] };
    }
    const lines = readFileSync(journalFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .slice(-Math.min(Math.max(n, 1), 50));
    const entries = lines.map((l) => JSON.parse(l));
    return { ok: true, path: journalFile, entries };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
