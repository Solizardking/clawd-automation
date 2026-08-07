/**
 * ooda/journal.ts — Append-only tick journal
 *
 * Every tick is written as a single JSON line to journal/ticks.jsonl.
 * This is the authoritative external record — the harness's memory.
 * State on restart is reconstructed by replaying this file.
 *
 * Clawd rule: "State lives in git."
 *
 * Override path with OODA_JOURNAL_PATH for isolated tests/CI so operator
 * journals under journal/ticks.jsonl are not corrupted.
 */

import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Decision } from './validate.js';
import type { Candle } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_JOURNAL_PATH = join(__dirname, 'journal', 'ticks.jsonl');

/** Format / resolve the journal path for display and I/O */
export function journalPath(): string {
  const override = process.env['OODA_JOURNAL_PATH']?.trim();
  if (override) return override;
  return DEFAULT_JOURNAL_PATH;
}

export interface TickEntry {
  tick: number;
  now: string;
  candles_last3: Candle[];
  book_snapshot: unknown;
  decision: Decision;
  outcome: 'applied' | 'rejected' | 'killswitch';
  violation?: string;
  pnl_lamports?: number;
  total_pnl_lamports?: number;
  consecutive_losses?: number;
  event?: string;
}

export function appendTick(entry: TickEntry): void {
  const path = journalPath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(entry) + '\n', 'utf8');
}

/** Read the last N entries from the journal (for observations injection) */
export function readLastEntries(n = 3): TickEntry[] {
  const path = journalPath();
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .slice(-n);
  return lines.map((l) => JSON.parse(l) as TickEntry);
}

/** Truncate journal to empty (for fresh run / tests) */
export function clearJournal(): void {
  const path = journalPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '', 'utf8');
}
