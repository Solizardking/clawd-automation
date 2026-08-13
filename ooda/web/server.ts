#!/usr/bin/env node
/**
 * ooda/web/server.ts — Local dashboard server for the Clawd OODA harness
 *
 * Serves a browser dashboard that:
 *   - tails journal/ticks.jsonl live over SSE (works for any run, including
 *     ones started from the CLI in another terminal)
 *   - can launch new paper/devnet loop runs via child_process and stream
 *     their status back
 *
 * The OODA loop side (journal tailing, /api/run, /api/stop) keeps the same
 * safety contract as the harness itself: paper + devnet only. This server
 * never signs anything itself and spawns `loop.ts`, which enforces
 * mode=paper/network=devnet at startup (see validate.ts / observe.ts).
 *
 * The dashboard also serves a separate live-trading page (trade.html) that
 * talks to real mainnet via DFlow + Helius (see live.ts) — that surface
 * proxies quotes/unsigned-transactions/confirmation only; the connected
 * browser wallet is what signs and broadcasts, never this server.
 *
 * Binds to localhost by default.
 *
 * Usage:
 *   npx tsx web/server.ts
 *   OODA_WEB_PORT=4321 npx tsx web/server.ts
 *
 * Fly.io 24/7 mode (see Dockerfile / fly.toml):
 *   OODA_WEB_HOST=0.0.0.0 (default when PORT is set by Fly)
 *   OODA_AUTORUN=1        continuously rerun loop.ts forever
 *   OODA_TICKS / OODA_SLEEP / OODA_SEED / OODA_LLM / OODA_GOBLIN
 *   OODA_JOURNAL_PATH=... persistent journal path (Fly volume)
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFileSync, existsSync, statSync, watch } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readLastEntries, journalPath } from '../journal.js';
import { parseClawdConfig } from '../validate.js';
import type { TickEntry } from '../journal.js';
import { handleAgentKitRoute } from './agent-kit.js';
import { handleLiveRoute } from './live.js';
import { paperLoopEnv, rpcStatusFields } from './rpc.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OODA_DIR = join(__dirname, '..');
const PUBLIC_DIR = join(__dirname, 'public');
// Fly injects PORT; OODA_WEB_PORT wins when set explicitly.
const PORT = parseInt(process.env['OODA_WEB_PORT'] ?? process.env['PORT'] ?? '4173', 10);
const HOST = process.env['OODA_WEB_HOST'] ?? '0.0.0.0';

// ─── 24/7 autorun daemon mode (Fly) ─────────────────────────────────────────
const AUTORUN = process.env['OODA_AUTORUN'] === '1';
const OODA_TICKS = Math.max(1, parseInt(process.env['OODA_TICKS'] ?? '100', 10) || 100);
const OODA_SLEEP = Math.max(0, parseFloat(process.env['OODA_SLEEP'] ?? '5') || 0);
const OODA_SEED = parseInt(process.env['OODA_SEED'] ?? '42', 10) || 42;
const OODA_LLM = process.env['OODA_LLM'] === '1';
const OODA_GOBLIN = process.env['OODA_GOBLIN'] === '1';
const AUTORUN_DELAY_MS = Math.max(1000, parseInt(process.env['OODA_RESTART_MS'] ?? '3000', 10));

const ENV_LOCAL_PATH = join(OODA_DIR, '.env.local');
if (existsSync(ENV_LOCAL_PATH)) {
  try {
    process.loadEnvFile(ENV_LOCAL_PATH);
  } catch {
    /* malformed or unreadable .env.local — live-trading routes fall back to dev/no-key mode */
  }
}

// ─── Normalised tick shape shared by journal replay + live SSE ────────────────

interface TickView {
  tick: number;
  now: string;
  price: number | null;
  decision: {
    action: string;
    reason: string;
    side?: string;
    size_lamports?: number;
    position_id?: string;
  } | null;
  outcome: string;
  violation?: string;
  pnl?: number;
  total_pnl_lamports: number;
  cash_lamports: number;
  unrealised_pnl?: number;
  positions: number;
  positions_detail?: { id: string; side: string; entry_price: number; size_lamports: number; opened_at_tick: number }[];
  consecutive_losses: number;
  event?: string;
}

function fromJournalEntry(e: TickEntry): TickView {
  const candles = e.candles_last3 ?? [];
  const lastCandle = candles[candles.length - 1];
  const snap = (e.book_snapshot ?? {}) as {
    positions?: TickView['positions_detail'];
    cash_lamports?: number;
    unrealised_pnl?: number;
  };
  return {
    tick: e.tick,
    now: e.now,
    price: lastCandle ? lastCandle.c : null,
    decision: e.decision ?? null,
    outcome: e.outcome,
    violation: e.violation,
    pnl: e.pnl_lamports,
    total_pnl_lamports: e.total_pnl_lamports ?? 0,
    cash_lamports: snap.cash_lamports ?? 0,
    unrealised_pnl: snap.unrealised_pnl,
    positions: Array.isArray(snap.positions) ? snap.positions.length : 0,
    positions_detail: snap.positions,
    consecutive_losses: e.consecutive_losses ?? 0,
    event: e.event,
  };
}

// ─── SSE hub ────────────────────────────────────────────────────────────────

interface SseClient {
  write: (chunk: string) => void;
}
const clients = new Set<SseClient>();

function broadcast(type: string, data: unknown): void {
  const chunk = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) c.write(chunk);
}

// ─── Journal tailing (source of truth for tick data) ───────────────────────────

let tailOffset = 0;

function primeTailOffset(): void {
  const path = journalPath();
  tailOffset = existsSync(path) ? statSync(path).size : 0;
}

function tailJournal(): void {
  const path = journalPath();
  if (!existsSync(path)) return;
  const size = statSync(path).size;
  if (size < tailOffset) tailOffset = 0; // journal was cleared/truncated
  if (size === tailOffset) return;
  // Read as raw bytes and slice by byte offset — statSync().size is a byte
  // count, so slicing a utf8-decoded string by that index breaks as soon as
  // the file contains any multi-byte character (offsets drift out of sync).
  const buf = readFileSync(path);
  const chunk = buf.subarray(tailOffset, size).toString('utf8');
  tailOffset = size;
  for (const line of chunk.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as TickEntry;
      broadcast('tick', fromJournalEntry(entry));
    } catch {
      /* malformed/partial line — safe to drop, journal write is append-only */
    }
  }
}

primeTailOffset();
try {
  watch(dirname(journalPath()), (_evt, filename) => {
    if (filename === 'ticks.jsonl') tailJournal();
  });
} catch {
  /* journal dir may not exist yet; poll fallback below still covers it */
}
// Poll fallback — fs.watch can miss events on some platforms/filesystems.
setInterval(tailJournal, 1000);

// ─── Run management (spawns loop.ts as a child process) ───────────────────────

let runningProc: ChildProcessWithoutNullStreams | null = null;
let runState: 'idle' | 'running' | 'done' | 'killswitch' | 'error' = 'idle';

interface RunOpts {
  ticks: number;
  sleep: number;
  seed: number;
  llm: boolean;
  goblin: boolean;
}

function startRun(opts: RunOpts): { ok: boolean; error?: string } {
  if (runningProc) return { ok: false, error: 'a run is already in progress' };

  const args = [
    'tsx', 'loop.ts',
    '--ticks', String(opts.ticks),
    '--sleep', String(opts.sleep),
    '--seed', String(opts.seed),
    '--tui',
  ];
  if (opts.llm) args.push('--llm');
  if (opts.goblin) args.push('--goblin');

  const proc = spawn('npx', args, { cwd: OODA_DIR, env: paperLoopEnv() });
  runningProc = proc;
  runState = 'running';
  broadcast('status', { state: runState });

  let buf = '';
  proc.stdout.on('data', (data: Buffer) => {
    buf += data.toString('utf8');
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line) as Record<string, unknown>;
        // Tick data itself flows through the journal tail (single source of
        // truth, includes full book detail); here we only need lifecycle events.
        if (ev['event'] === 'start') {
          broadcast('run-start', ev);
        } else if (ev['event'] === 'killswitch') {
          runState = 'killswitch';
          broadcast('status', { state: runState });
        } else if (ev['event'] === 'done') {
          runState = 'done';
          broadcast('status', { state: runState, summary: ev });
        }
      } catch {
        /* ignore non-JSON stdout noise */
      }
    }
  });
  proc.stderr.on('data', (data: Buffer) => {
    broadcast('log', { line: data.toString('utf8') });
  });
  proc.on('exit', (code) => {
    runningProc = null;
    if (runState === 'running') runState = code === 0 ? 'done' : 'error';
    broadcast('status', { state: runState, code });
    tailJournal(); // pick up the final tick immediately rather than wait for poll
    if (AUTORUN) {
      // 24/7 daemon: schedule the next run so the journal + dashboard
      // keep updating forever.
      process.stdout.write(`[ooda-web] autorun: next run in ${AUTORUN_DELAY_MS}ms\n`);
      setTimeout(startAutorun, AUTORUN_DELAY_MS);
    }
  });

  return { ok: true };
}

function startAutorun(): void {
  if (runningProc || !AUTORUN) return;
  process.stdout.write(
    `[ooda-web] autorun: ${OODA_TICKS} ticks sleep=${OODA_SLEEP}s llm=${OODA_LLM} goblin=${OODA_GOBLIN}\n`,
  );
  const result = startRun({
    ticks: OODA_TICKS,
    sleep: OODA_SLEEP,
    seed: OODA_SEED,
    llm: OODA_LLM,
    goblin: OODA_GOBLIN,
  });
  if (!result.ok) process.stderr.write(`[ooda-web] autorun failed to start: ${result.error}\n`);
}

function stopRun(): { ok: boolean; error?: string } {
  if (!runningProc) return { ok: false, error: 'no run in progress' };
  runningProc.kill('SIGTERM');
  return { ok: true };
}

// ─── HTTP plumbing ──────────────────────────────────────────────────────────

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function serveStatic(res: ServerResponse, filePath: string): void {
  const resolved = normalize(filePath);
  if (!resolved.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  if (!existsSync(resolved) || statSync(resolved).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const mime = MIME[extname(resolved)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  res.end(readFileSync(resolved));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c: Buffer) => { body += c.toString('utf8'); });
    req.on('end', () => resolve(body));
  });
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/live/')) {
    void handleLiveRoute(res, url).then((handled) => {
      if (!handled) {
        res.writeHead(404);
        res.end('not found');
      }
    });
    return;
  }

  if (url.pathname.startsWith('/api/agent/')) {
    void handleAgentKitRoute(req, res, url).then((handled) => {
      if (!handled) {
        res.writeHead(404);
        res.end('not found');
      }
    });
    return;
  }

  if (url.pathname === '/api/journal') {
    const n = Math.min(1000, parseInt(url.searchParams.get('n') ?? '300', 10) || 300);
    sendJson(res, 200, readLastEntries(n).map(fromJournalEntry));
    return;
  }

  if (url.pathname === '/api/status') {
    sendJson(res, 200, {
      state: runState,
      journalPath: journalPath(),
      agentKitConfigured: Boolean(process.env['AGENT_KIT_URL']),
      ...rpcStatusFields(),
    });
    return;
  }

  if (url.pathname === '/api/config') {
    try {
      const goblin = url.searchParams.get('goblin') === '1';
      const file = join(OODA_DIR, goblin ? 'goblin.md' : 'CLAWD.md');
      sendJson(res, 200, parseClawdConfig(readFileSync(file, 'utf8')));
    } catch (err) {
      sendJson(res, 500, { error: String(err) });
    }
    return;
  }

  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(': connected\n\n');
    const client: SseClient = { write: (chunk) => res.write(chunk) };
    clients.add(client);
    res.write(`event: status\ndata: ${JSON.stringify({ state: runState })}\n\n`);
    const keepAlive = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(keepAlive);
      clients.delete(client);
    });
    return;
  }

  if (url.pathname === '/api/run' && req.method === 'POST') {
    void readBody(req).then((body) => {
      let opts: Partial<RunOpts> = {};
      try {
        opts = JSON.parse(body || '{}') as Partial<RunOpts>;
      } catch {
        /* use defaults */
      }
      const result = startRun({
        ticks: Math.max(1, Math.min(5000, parseInt(String(opts.ticks ?? 50), 10) || 50)),
        sleep: Math.max(0, parseFloat(String(opts.sleep ?? 0.25)) || 0),
        seed: parseInt(String(opts.seed ?? 42), 10) || 42,
        llm: Boolean(opts.llm),
        goblin: Boolean(opts.goblin),
      });
      sendJson(res, result.ok ? 200 : 409, result);
    });
    return;
  }

  if (url.pathname === '/api/stop' && req.method === 'POST') {
    const result = stopRun();
    sendJson(res, result.ok ? 200 : 409, result);
    return;
  }

  const filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  serveStatic(res, join(PUBLIC_DIR, filePath));
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`[ooda-web] dashboard  http://${HOST}:${PORT}\n`);
  process.stdout.write(`[ooda-web] journal    ${journalPath()}\n`);
  process.stdout.write(`[ooda-web] paper + devnet only — same safety contract as the CLI harness\n`);
  if (AUTORUN) startAutorun();
});
