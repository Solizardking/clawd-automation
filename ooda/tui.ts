#!/usr/bin/env node
/**
 * ooda/tui.ts — Dark ANSI TUI renderer for the OODA loop
 *
 * Reads JSONL from stdin (loop.ts --tui output) and renders a
 * live dark-themed dashboard. Pipe usage:
 *
 *   npx tsx ooda/loop.ts --ticks 200 --sleep 0.4 --tui | npx tsx ooda/tui.ts
 *
 * Also standalone-importable by the main hermes TUI.
 */

import { createInterface } from 'node:readline';
import chalk from 'chalk';

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const CLEAR = '\x1b[2J\x1b[H';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

// ─── State ────────────────────────────────────────────────────────────────────

export interface TickEvent {
  event: 'tick' | 'start' | 'done' | 'killswitch';
  tick?: number;
  now?: string;
  price?: number;
  decision?: { action: string; reason: string; side?: string; size_lamports?: number; position_id?: string };
  outcome?: string;
  pnl?: number;
  total_pnl_lamports?: number;
  cash_lamports?: number;
  positions?: number;
  consecutive_losses?: number;
  ticks?: number;
}

export interface DisplayState {
  lastTick: number;
  totalTicks: number;
  price: number;
  priceHistory: number[];
  lastDecision: TickEvent['decision'] | null;
  lastOutcome: string;
  totalPnl: number;
  cash: number;
  openPositions: number;
  consecutiveLosses: number;
  log: string[];
  done: boolean;
  killswitch: boolean;
}

const ds: DisplayState = {
  lastTick: 0,
  totalTicks: 0,
  price: 0,
  priceHistory: [],
  lastDecision: null,
  lastOutcome: '',
  totalPnl: 0,
  cash: 0,
  openPositions: 0,
  consecutiveLosses: 0,
  log: [],
  done: false,
  killswitch: false,
};

// ─── Sparkline ────────────────────────────────────────────────────────────────

const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

function sparkline(prices: number[], width = 30): string {
  if (prices.length < 2) return chalk.gray('·'.repeat(width));
  const slice = prices.slice(-width);
  const min = Math.min(...slice);
  const max = Math.max(...slice);
  const range = max - min || 1;
  return slice
    .map(p => {
      const idx = Math.round(((p - min) / range) * (SPARK.length - 1));
      const bar = SPARK[idx] ?? '▄';
      const isUp = p > prices[prices.indexOf(p) - 1];
      return isUp ? chalk.green(bar) : chalk.red(bar);
    })
    .join('');
}

// ─── Render ───────────────────────────────────────────────────────────────────

function pnlColor(n: number): string {
  const s = (n >= 0 ? '+' : '') + n.toLocaleString() + ' lamports';
  return n >= 0 ? chalk.green(s) : chalk.red(s);
}

// ─── Pure event apply (importable for tests) ──────────────────────────────────

/** Apply a structured loop event to display state. Returns true if state changed. */
export function applyTickEvent(state: DisplayState, ev: TickEvent): boolean {
  if (ev.event === 'start') {
    state.totalTicks = ev.ticks ?? 50;
    return true;
  }
  if (ev.event === 'tick') {
    state.lastTick = ev.tick ?? state.lastTick;
    state.price = ev.price ?? state.price;
    state.priceHistory.push(state.price);
    if (state.priceHistory.length > 60) state.priceHistory.shift();
    state.lastDecision = ev.decision ?? state.lastDecision;
    state.lastOutcome = ev.outcome ?? '';
    state.totalPnl = ev.total_pnl_lamports ?? state.totalPnl;
    state.cash = ev.cash_lamports ?? state.cash;
    state.openPositions = ev.positions ?? state.openPositions;
    state.consecutiveLosses = ev.consecutive_losses ?? state.consecutiveLosses;

    const action = ev.decision?.action ?? 'hold';
    const actionColor =
      action === 'open' ? chalk.green : action === 'close' ? chalk.red : chalk.gray;
    state.log.push(
      `  ${chalk.gray(new Date(ev.now ?? '').toTimeString().slice(0, 8))} ` +
        `[${chalk.yellow('T' + ev.tick)}] ` +
        `${actionColor(action.toUpperCase().padEnd(5))} ` +
        chalk.white((ev.decision?.reason ?? '').slice(0, 55)),
    );
    return true;
  }
  if (ev.event === 'killswitch') {
    state.killswitch = true;
    state.done = true;
    return true;
  }
  if (ev.event === 'done') {
    state.done = true;
    return true;
  }
  return false;
}

/** Render display state to a single multi-line string (no ANSI clear). */
export function renderDisplay(state: DisplayState, columns = 100): string {
  const lines: string[] = [];
  const w = columns;
  const border = chalk.magenta('═'.repeat(w));

  lines.push(chalk.magenta('╔') + border + chalk.magenta('╗'));
  const title = '  🦞 CLAWD OODA — Paper Loop  ·  devnet  ·  paper  ';
  const titlePad = Math.max(0, w - title.length);
  lines.push(
    chalk.magenta('║') +
      chalk.bold.magenta(title) +
      ' '.repeat(titlePad) +
      chalk.magenta('║'),
  );
  lines.push(chalk.magenta('╠') + border + chalk.magenta('╣'));

  const pct = state.totalTicks > 0 ? state.lastTick / state.totalTicks : 0;
  const barW = Math.max(10, w - 20);
  const filled = Math.round(pct * barW);
  const bar =
    chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(barW - filled));
  const pctStr = `  Tick ${state.lastTick}/${state.totalTicks} [${bar}] ${Math.round(pct * 100)}%`;
  const pctPad = Math.max(
    0,
    w - pctStr.replace(/\x1b\[[0-9;]*m/g, '').length,
  );
  lines.push(chalk.magenta('║') + pctStr + ' '.repeat(pctPad) + chalk.magenta('║'));

  const priceStr = state.price > 0 ? `$${(state.price / 1000).toFixed(3)}` : '---';
  const spark = sparkline(state.priceHistory, Math.min(40, w - 30));
  const priceRow = `  SOL ~${chalk.yellow.bold(priceStr)}  ${spark}`;
  const priceRowPlain =
    `  SOL ~${priceStr}  ` + '·'.repeat(Math.min(40, w - 30));
  const pricePad = Math.max(0, w - priceRowPlain.length);
  lines.push(
    chalk.magenta('║') + priceRow + ' '.repeat(pricePad) + chalk.magenta('║'),
  );

  const dec = state.lastDecision;
  let decStr = '  [--] waiting…';
  if (dec) {
    const actionColor =
      dec.action === 'open'
        ? chalk.green
        : dec.action === 'close'
          ? chalk.red
          : chalk.gray;
    const outcomeColor =
      state.lastOutcome === 'rejected'
        ? chalk.red
        : state.lastOutcome === 'killswitch'
          ? chalk.bgRed.white
          : chalk.cyan;
    decStr = `  [${actionColor(dec.action.toUpperCase())}] ${chalk.white(dec.reason?.slice(0, 70) ?? '')}  ${outcomeColor(state.lastOutcome)}`;
  }
  const decPlain = `  [${dec?.action?.toUpperCase() ?? '--'}] ${dec?.reason?.slice(0, 70) ?? ''}  ${state.lastOutcome}`;
  const decPad = Math.max(0, w - decPlain.length);
  lines.push(chalk.magenta('║') + decStr + ' '.repeat(decPad) + chalk.magenta('║'));

  lines.push(chalk.magenta('╠') + border + chalk.magenta('╣'));

  const statsRow = [
    `  PnL: ${pnlColor(state.totalPnl)}`,
    `Cash: ${chalk.cyan(state.cash.toLocaleString())} lam`,
    `Pos: ${chalk.yellow(state.openPositions)}`,
    `Losses: ${state.consecutiveLosses > 0 ? chalk.red(state.consecutiveLosses) : chalk.gray('0')}`,
  ].join('  ·  ');
  const statsPlain = `  PnL: ${state.totalPnl >= 0 ? '+' : ''}${state.totalPnl} lamports  ·  Cash: ${state.cash} lam  ·  Pos: ${state.openPositions}  ·  Losses: ${state.consecutiveLosses}`;
  const statsPad = Math.max(0, w - statsPlain.length);
  lines.push(
    chalk.magenta('║') + statsRow + ' '.repeat(statsPad) + chalk.magenta('║'),
  );

  lines.push(chalk.magenta('╠') + border + chalk.magenta('╣'));
  for (const entry of state.log.slice(-6)) {
    const pad = Math.max(0, w - entry.replace(/\x1b\[[0-9;]*m/g, '').length);
    lines.push(chalk.magenta('║') + entry + ' '.repeat(pad) + chalk.magenta('║'));
  }

  if (state.done) {
    lines.push(chalk.magenta('╠') + border + chalk.magenta('╣'));
    const doneMsg = state.killswitch
      ? '  ⛔ KILLSWITCH TRIGGERED — consecutive losses limit reached'
      : '  ✅ Loop complete — see ooda/journal/ticks.jsonl for full log';
    const donePad = Math.max(0, w - doneMsg.length);
    lines.push(
      chalk.magenta('║') +
        chalk.bold(
          state.killswitch ? chalk.red(doneMsg) : chalk.green(doneMsg),
        ) +
        ' '.repeat(donePad) +
        chalk.magenta('║'),
    );
  }
  lines.push(chalk.magenta('╚') + border + chalk.magenta('╝'));
  return lines.join('\n');
}

export function createDisplayState(): DisplayState {
  return {
    lastTick: 0,
    totalTicks: 0,
    price: 0,
    priceHistory: [],
    lastDecision: null,
    lastOutcome: '',
    totalPnl: 0,
    cash: 0,
    openPositions: 0,
    consecutiveLosses: 0,
    log: [],
    done: false,
    killswitch: false,
  };
}

// ─── Main (only when executed as entry) ───────────────────────────────────────

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('/tui.ts') ||
    process.argv[1].endsWith('\\tui.ts') ||
    process.argv[1].endsWith('/tui.js') ||
    process.argv[1].endsWith('\\tui.js'));

if (isMain) {
  process.stdout.write(HIDE_CURSOR);
  process.on('exit', () => process.stdout.write(SHOW_CURSOR));
  process.on('SIGINT', () => {
    process.stdout.write(SHOW_CURSOR);
    process.exit(0);
  });

  const rl = createInterface({ input: process.stdin });

  rl.on('line', (line: string) => {
    if (!line.trim()) return;
    try {
      const ev = JSON.parse(line) as TickEvent;
      applyTickEvent(ds, ev);
      process.stdout.write(CLEAR + renderDisplay(ds) + '\n');
    } catch {
      /* skip non-JSON */
    }
  });

  rl.on('close', () => {
    ds.done = true;
    process.stdout.write(CLEAR + renderDisplay(ds) + '\n');
    process.stdout.write(SHOW_CURSOR);
  });
}
