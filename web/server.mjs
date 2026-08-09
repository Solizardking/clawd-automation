#!/usr/bin/env node
/**
 * web/server.mjs — Clawd Automation Fly machine client
 *
 * A zero-dependency Node server that hosts and connects to every module in
 * the automation monorepo:
 *
 *   agent/            openclawd-solana-kit (Rust)   → version, docs surface
 *   clawd-connectors/ MCP connectors                 → provider status
 *   constitution/     Clawd harness (8 docs)         → manifest probe
 *   data/hedge/       hedge personas                 → count probe
 *   dist/             compiled ESM runtime           → version probe
 *   docs/             README media + publish notes   → doc links
 *   knowledge/        JSONL + markdown memory        → collection probe
 *   lib/              legacy JS helpers              → file probe
 *   lobster-council/  six voice seats                → seat probe
 *   ooda/             paper/devnet OODA harness      → run, stop, journal SSE
 *   packages/         creator CLI package            → package probe
 *   scripts/          install/publish scripts        → file probe
 *   src/              ESM runtime source             → file probe
 *   zk-primitives/    nullifiers · Groth16 · Light   → manifest probe
 *
 * Safety contract (mirrors ooda/web/server.ts):
 *   - the OODA loop spawn path is paper + devnet only (loop.ts enforces it)
 *   - live trading stays browser-wallet-signed via /api/live/* (proxied only)
 *   - this server never holds or signs with a private key
 *
 * Usage:
 *   node web/server.mjs
 *   WEB_PORT=4321 node web/server.mjs
 *   PORT=8080 node web/server.mjs        (Fly injects PORT)
 *
 * Fly machine deploy: see web/Dockerfile + web/fly.toml.
 */

import { spawn } from 'node:child_process';
import {
  readFileSync,
  existsSync,
  statSync,
  readdirSync,
  watch,
} from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OODA_DIR = join(ROOT, 'ooda');
const PUBLIC_DIR = join(__dirname, 'public');

const PORT = parseInt(process.env['WEB_PORT'] ?? process.env['PORT'] ?? '8080', 10);
const HOST = process.env['WEB_HOST'] ?? '0.0.0.0';

// 24/7 autorun (Fly): continuously rerun ooda/loop.ts in paper mode.
const AUTORUN = process.env['OODA_AUTORUN'] === '1';
const OODA_TICKS = Math.max(1, parseInt(process.env['OODA_TICKS'] ?? '100', 10) || 100);
const OODA_SLEEP = Math.max(0, parseFloat(process.env['OODA_SLEEP'] ?? '5') || 0);
const OODA_SEED = parseInt(process.env['OODA_SEED'] ?? '42', 10) || 42;
const OODA_LLM = process.env['OODA_LLM'] === '1';
const OODA_GOBLIN = process.env['OODA_GOBLIN'] === '1';
const AUTORUN_DELAY_MS = Math.max(1000, parseInt(process.env['OODA_RESTART_MS'] ?? '3000', 10));

// Load ooda/.env.local for DFlow / Helius keys used by the live-trade proxy.
try {
  const envLocal = join(OODA_DIR, '.env.local');
  if (existsSync(envLocal)) process.loadEnvFile(envLocal);
} catch {
  /* live-trade routes fall back to dev/no-key mode */
}

// ─── Module registry ─────────────────────────────────────────────────────────
// Every top-level tree in the monorepo with a probe, a doc path, and a role.

const MODULES = [
  {
    id: 'src',
    name: 'src/ · ESM runtime',
    path: 'src',
    role: 'Sovereign agent loop + heartbeat + survival + shell + inference',
    probe: () => existsSync(join(ROOT, 'src/index.ts')),
  },
  {
    id: 'dist',
    name: 'dist/ · shipped CLI',
    path: 'dist',
    role: 'Compiled runtime — bins automaton / clawd-automaton',
    probe: () => ({ present: existsSync(join(ROOT, 'dist/index.js')) }),
  },
  {
    id: 'agent',
    name: 'agent/ · openclawd-solana-kit (Rust)',
    path: 'agent',
    role: 'Solana/EVM agent tools: swaps, transfers, portfolio, Pump.fun, HTTP SSE',
    probe: () => {
      const tomlPath = join(ROOT, 'agent/Cargo.toml');
      const present = existsSync(tomlPath);
      let name = null;
      if (present) {
        try {
          name = extractCargoName(readFileSync(tomlPath, 'utf8')) ?? 'openclawd-solana-kit';
        } catch {
          name = 'openclawd-solana-kit';
        }
      }
      return { present, cargo: name };
    },
  },
  {
    id: 'clawd-connectors',
    name: 'clawd-connectors/ · MCP',
    path: 'clawd-connectors',
    role: 'MCP connectors: DFlow · Helius · Jupiter · Birdeye',
    probe: (state) => {
      const pkg = loadJson(join(ROOT, 'clawd-connectors/package.json'), state, 'not present');
      return {
        present: existsSync(join(ROOT, 'clawd-connectors/package.json')),
        keys: ['DFLOW_API_KEY', 'HELIUS_API_KEY', 'JUPITER_API_KEY', 'BIRDEYE_API_KEY'].map((k) => ({
          key: k,
          set: Boolean(process.env[k]),
        })),
      };
    },
  },
  {
    id: 'constitution',
    name: 'constitution/ · Clawd harness',
    path: 'constitution',
    role: '8 canonical docs — Laws I–III immutable, runtime load path',
    probe: () => {
      const docs = ['three-laws.md', 'six-laws.md', 'CONSTITUTION.md', 'CLAWD.md', 'IDENTITY.md', 'SOUL.md', 'program.md', 'strategy.md'];
      const present = docs.filter((d) => existsSync(join(ROOT, 'constitution', d)));
      return { present: present.length, total: docs.length, docs: present };
    },
  },
  {
    id: 'data',
    name: 'data/hedge/ · hedge personas',
    path: 'data',
    role: 'Five investor-lobster bios via src/services/personas.js',
    probe: () => {
      const HEDGE_PERSONAS = ['activistpinch', 'latticeclaw', 'moatmaw', 'soltoshi', 'valueclaw'];
      const present = HEDGE_PERSONAS.filter((p) => existsSync(join(ROOT, 'data/hedge', `${p}.json`)));
      return { present: present.length, total: HEDGE_PERSONAS.length, personas: present };
    },
  },
  {
    id: 'knowledge',
    name: 'knowledge/ · memory',
    path: 'knowledge',
    role: 'JSONL memory + markdown docs',
    probe: () => {
      const jsonl = safeReaddir(join(ROOT, 'knowledge')).filter((f) => f.endsWith('.jsonl'));
      const md = safeReaddir(join(ROOT, 'knowledge')).filter((f) => f.endsWith('.md'));
      return { present: existsSync(join(ROOT, 'knowledge/README.md')), jsonl: jsonl.length, md: md.length };
    },
  },
  {
    id: 'lib',
    name: 'lib/ · legacy helpers',
    path: 'lib',
    role: 'Legacy / helper JS surface (optional)',
    probe: () => existsSync(join(ROOT, 'lib/index.js')),
  },
  {
    id: 'lobster-council',
    name: 'lobster-council/ · six voice seats',
    path: 'lobster-council',
    role: 'Six seat JSON → CJS lobster_council capability',
    probe: () => {
      const files = safeReaddir(join(ROOT, 'lobster-council')).filter((f) => f.endsWith('.json'));
      return { present: files.length, seats: files };
    },
  },
  {
    id: 'ooda',
    name: 'ooda/ · OODA harness',
    path: 'ooda',
    role: 'Paper/devnet decision loop + live-trading web panel',
    probe: () => {
      const pkg = loadJson(join(ROOT, 'ooda/package.json'), {}, 'not present');
      const name = pkg?.name ?? null;
      const hasClawdMd = existsSync(join(ROOT, 'ooda/CLAWD.md'));
      const hasGoblin = existsSync(join(ROOT, 'ooda/goblin.md'));
      const hasLoop = existsSync(join(ROOT, 'ooda/loop.ts'));
      return { present: hasLoop, package: name, hasClawdMd, hasGoblin };
    },
  },
  {
    id: 'packages',
    name: 'packages/cli/ · creator CLI',
    path: 'packages',
    role: '@onchainai/automaton-cli',
    probe: () => {
      const pkg = loadJson(join(ROOT, 'packages/cli/package.json'), {}, 'not present');
      return { present: existsSync(join(ROOT, 'packages/cli/package.json')), package: pkg?.name ?? null };
    },
  },
  {
    id: 'scripts',
    name: 'scripts/ · tooling',
    path: 'scripts',
    role: 'Install · postbuild · pack verify · npm publish',
    probe: () => {
      const files = safeReaddir(join(ROOT, 'scripts'));
      return { present: files.length > 0, scripts: files };
    },
  },
  {
    id: 'docs',
    name: 'docs/ · media + publish notes',
    path: 'docs',
    role: 'README media + npm publish runbook',
    probe: () => existsSync(join(ROOT, 'docs/npm-publish.md')),
  },
  {
    id: 'zk-primitives',
    name: 'zk-primitives/ · ZK',
    path: 'zk-primitives',
    role: 'Nullifiers · Groth16 · Light compressed state · ZK Shark',
    probe: () => {
      const manifest = loadJson(join(ROOT, 'zk-primitives/MANIFEST.json'), {}, 'not present');
      const ops = Array.isArray(manifest?.operations) ? manifest.operations : [];
      return {
        present: existsSync(join(ROOT, 'zk-primitives/MANIFEST.json')),
        programId: manifest?.programId ?? null,
        operations: ops.map((o) => (typeof o === 'string' ? o : o?.name ?? '?')).slice(0, 12),
      };
    },
  },
  {
    id: 'web',
    name: 'web/ · this client',
    path: 'web',
    role: 'Fly machine client — hosts + connects to everything above',
    probe: () => ({ present: true, port: PORT }),
  },
];

function safeReaddir(p) {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}

function loadJson(p, state, missingMsg) {
  try {
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    state.warn = state.warn ?? [];
    state.warn.push(`${p}: unreadable`);
    return null;
  }
}

function extractCargoName(toml) {
  const m = toml.match(/^name\s*=\s*"([^"]+)"/m);
  return m ? m[1] : null;
}

function probeAll() {
  const state = {};
  return MODULES.map((mod) => {
    let ok = false;
    let detail = null;
    try {
      detail = mod.probe(state) ?? true;
      ok = detail?.present !== false && (detail !== null && detail !== undefined);
      if (typeof detail === 'object') ok = detail.present !== false;
      if (detail === true) ok = true;
    } catch {
      ok = false;
    }
    if (state.warn?.length) {
      detail = detail ?? {};
      detail.warnings = state.warn;
      state.warn = [];
    }
    return { id: mod.id, name: mod.name, path: mod.path, role: mod.role, ok, detail };
  });
}

// ─── OODA journal tailing (SSE source) ───────────────────────────────────────

function journalPathOverride() {
  return process.env['OODA_JOURNAL_PATH'] ?? join(OODA_DIR, 'journal', 'ticks.jsonl');
}

function readLastEntries(n) {
  const p = journalPathOverride();
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, 'utf8').split('\n').filter(Boolean);
  const parsed = [];
  for (const line of raw.slice(-n)) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      /* skip malformed */
    }
  }
  return parsed;
}

// ─── SSE hub ─────────────────────────────────────────────────────────────────

const sseClients = new Set();

function broadcast(type, data) {
  const chunk = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of sseClients) c.write(chunk);
}

let tailOffset = 0;
function primeTailOffset() {
  const p = journalPathOverride();
  tailOffset = existsSync(p) ? statSync(p).size : 0;
}
function tailJournal() {
  const p = journalPathOverride();
  if (!existsSync(p)) return;
  const size = statSync(p).size;
  if (size < tailOffset) tailOffset = 0;
  if (size === tailOffset) return;
  const buf = readFileSync(p);
  const chunk = buf.subarray(tailOffset, size).toString('utf8');
  tailOffset = size;
  for (const line of chunk.split('\n')) {
    if (!line.trim()) continue;
    try {
      broadcast('tick', JSON.parse(line));
    } catch {
      /* skip malformed */
    }
  }
}
primeTailOffset();
try {
  watch(dirname(journalPathOverride()), (_evt, filename) => {
    if (filename === 'ticks.jsonl') tailJournal();
  });
} catch {
  /* poll fallback below covers it */
}
setInterval(tailJournal, 1000);

// ─── OODA run manager (paper only — loop.ts enforces it) ─────────────────────

let runningProc = null;
let runState = 'idle';

function startRun(opts) {
  if (runningProc) return { ok: false, error: 'a run is already in progress' };
  const hasTsx = existsSync(join(OODA_DIR, 'node_modules', '.bin', 'tsx')) ||
    existsSync(join(ROOT, 'node_modules', '.bin', 'tsx'));
  if (!hasTsx) {
    return { ok: false, error: 'tsx not installed — run `cd ooda && npm install`' };
  }
  const args = ['tsx', 'loop.ts', '--ticks', String(opts.ticks), '--sleep', String(opts.sleep), '--seed', String(opts.seed), '--tui'];
  if (opts.llm) args.push('--llm');
  if (opts.goblin) args.push('--goblin');
  const proc = spawn('npx', args, { cwd: OODA_DIR });
  runningProc = proc;
  runState = 'running';
  broadcast('status', { state: runState });

  let buf = '';
  proc.stdout.on('data', (data) => {
    buf += data.toString('utf8');
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);
        if (ev.event === 'start') broadcast('run-start', ev);
        else if (ev.event === 'killswitch') {
          runState = 'killswitch';
          broadcast('status', { state: runState });
        } else if (ev.event === 'done') {
          runState = 'done';
          broadcast('status', { state: runState, summary: ev });
        }
      } catch {
        /* non-JSON stdout noise */
      }
    }
  });
  proc.stderr.on('data', (data) => broadcast('log', { line: data.toString('utf8') }));
  proc.on('exit', (code) => {
    runningProc = null;
    if (runState === 'running') runState = code === 0 ? 'done' : 'error';
    broadcast('status', { state: runState, code });
    tailJournal();
    if (AUTORUN) {
      process.stdout.write(`[web] autorun: next run in ${AUTORUN_DELAY_MS}ms\n`);
      setTimeout(startAutorun, AUTORUN_DELAY_MS);
    }
  });
  return { ok: true };
}

function startAutorun() {
  if (runningProc || !AUTORUN) return;
  process.stdout.write(`[web] autorun: ${OODA_TICKS} ticks sleep=${OODA_SLEEP}s llm=${OODA_LLM} goblin=${OODA_GOBLIN}\n`);
  const result = startRun({ ticks: OODA_TICKS, sleep: OODA_SLEEP, seed: OODA_SEED, llm: OODA_LLM, goblin: OODA_GOBLIN });
  if (!result.ok) process.stderr.write(`[web] autorun failed to start: ${result.error}\n`);
}

function stopRun() {
  if (!runningProc) return { ok: false, error: 'no run in progress' };
  runningProc.kill('SIGTERM');
  return { ok: true };
}

// ─── HTTP plumbing ───────────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

function serveFile(res, filePath) {
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const mime = MIME[extname(filePath)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  res.end(readFileSync(filePath));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c.toString('utf8'); });
    req.on('end', () => resolve(body));
  });
}

// Safe module-file hosting: only allow files under the requested module dir.
function serveModuleFile(res, modId, rel) {
  const mod = MODULES.find((m) => m.id === modId);
  if (!mod) {
    res.writeHead(404);
    res.end('unknown module');
    return;
  }
  const base = normalize(join(ROOT, mod.path));
  const requested = normalize(join(base, rel));
  if (!requested.startsWith(base)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  serveFile(res, requested);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;

  // Live-trade proxy routes — forward to the OODA web server if running.
  if (path.startsWith('/api/live/')) {
    void handleLiveRoute(res, url).then((handled) => {
      if (!handled) sendJson(res, 404, { error: 'not found' });
    });
    return;
  }

  // ── Core API ────────────────────────────────────────────────
  if (path === '/api/modules') {
    sendJson(res, 200, { modules: probeAll(), root: ROOT });
    return;
  }

  if (path === '/api/status') {
    sendJson(res, 200, { state: runState, journalPath: journalPathOverride(), autorun: AUTORUN });
    return;
  }

  if (path === '/api/journal') {
    const n = Math.min(1000, parseInt(url.searchParams.get('n') ?? '300', 10) || 300);
    sendJson(res, 200, readLastEntries(n));
    return;
  }

  if (path === '/api/config') {
    try {
      const goblin = url.searchParams.get('goblin') === '1';
      const f = join(OODA_DIR, goblin ? 'goblin.md' : 'CLAWD.md');
      sendJson(res, 200, { config: readFileSync(f, 'utf8').slice(0, 20000) });
    } catch {
      sendJson(res, 404, { error: 'config not found' });
    }
    return;
  }

  if (path === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(': connected\n\n');
    const client = { write: (chunk) => res.write(chunk) };
    sseClients.add(client);
    res.write(`event: status\ndata: ${JSON.stringify({ state: runState })}\n\n`);
    const keepAlive = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(client);
    });
    return;
  }

  if (path === '/api/run' && req.method === 'POST') {
    void readBody(req).then((body) => {
      let opts = {};
      try {
        opts = JSON.parse(body || '{}');
      } catch {
        /* defaults */
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

  if (path === '/api/stop' && req.method === 'POST') {
    const result = stopRun();
    sendJson(res, result.ok ? 200 : 409, result);
    return;
  }

  // Module-hosted file serving: /module/<id>/<relative-path>
  const moduleMatch = path.match(/^\/module\/([^/]+)\/(.+)$/);
  if (moduleMatch) {
    serveModuleFile(res, moduleMatch[1], decodeURIComponent(moduleMatch[2]));
    return;
  }

  // Static dashboard
  const filePath = path === '/' ? '/index.html' : path;
  serveFile(res, join(PUBLIC_DIR, filePath));
});

async function handleLiveRoute(res, url) {
  // Proxy to the ooda web server's live-trade routes only if that server is up.
  // The dashboard's trade page connects a browser wallet; this server only
  // relays quotes/confirmation — never keys.
  const proxyPort = parseInt(process.env['OODA_LIVE_PORT'] ?? '0', 10);
  if (!proxyPort) return false;
  const { request } = await import('node:http');
  const targetPath = url.pathname + (url.search ?? '');
  return new Promise((resolve) => {
    const proxy = request({ host: '127.0.0.1', port: proxyPort, path: targetPath, method: 'GET' }, (up) => {
      const chunks = [];
      up.on('data', (c) => chunks.push(c));
      up.on('end', () => {
        const body = Buffer.concat(chunks);
        res.writeHead(up.statusCode ?? 502, { 'Content-Type': up.headers['content-type'] ?? 'application/json' });
        res.end(body);
        resolve(true);
      });
    });
    proxy.on('error', () => resolve(false));
    proxy.end();
  });
}

server.listen(PORT, HOST, () => {
  process.stdout.write(`[web] automation client  http://${HOST}:${PORT}\n`);
  process.stdout.write(`[web] root                ${ROOT}\n`);
  process.stdout.write(`[web] ooda journal        ${journalPathOverride()}\n`);
  process.stdout.write(`[web] paper + devnet only — same safety contract as the CLI harness\n`);
  if (AUTORUN) startAutorun();
});