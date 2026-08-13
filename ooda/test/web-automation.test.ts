/**
 * Drives the shipped web agent-kit handler and live/automation RPC helper.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleAgentKitRoute } from '../web/agent-kit.js';
import {
  AUTOMATION_TARGET_MINT,
  PAPER_SOLANA_RPC_URL,
  paperLoopEnv,
  rpcSource,
  solanaRpcUrl,
} from '../web/rpc.js';
import { parseClawdConfig } from '../validate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function listen(server: Server): Promise<{ base: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('expected tcp address'));
        return;
      }
      resolve({
        base: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise((res, rej) => server.close((err) => (err ? rej(err) : res()))),
      });
    });
  });
}

function startProxyServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    void handleAgentKitRoute(req, res, url).then((handled) => {
      if (!handled) {
        res.writeHead(404);
        res.end('not found');
      }
    });
  });
  return listen(server);
}

describe('solanaRpcUrl helper', { concurrency: false }, () => {
  const keys = ['SOLANA_RPC_URL', 'HELIUS_RPC_URL', 'HELIUS_API_KEY'] as const;
  const saved: Record<string, string | undefined> = {};

  before(() => {
    for (const k of keys) saved[k] = process.env[k];
  });

  after(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('returns process.env.SOLANA_RPC_URL when set', () => {
    const injected = `http://127.0.0.1:9${String(Date.now()).slice(-4)}/solana-rpc`;
    process.env['SOLANA_RPC_URL'] = injected;
    delete process.env['HELIUS_RPC_URL'];
    delete process.env['HELIUS_API_KEY'];
    assert.equal(solanaRpcUrl(), process.env['SOLANA_RPC_URL']);
    assert.equal(solanaRpcUrl(), injected);
    assert.equal(rpcSource(), 'SOLANA_RPC_URL');
  });

  it('falls back to Helius only when SOLANA_RPC_URL is unset', () => {
    delete process.env['SOLANA_RPC_URL'];
    const helius = `http://127.0.0.1:9${String(Date.now()).slice(-4)}/helius`;
    process.env['HELIUS_RPC_URL'] = helius;
    assert.equal(solanaRpcUrl(), helius);
    assert.equal(rpcSource(), 'HELIUS_RPC_URL');
  });
});

describe('paperLoopEnv isolation', () => {
  it('forces devnet RPC and strips MAINNET_OK even if parent is mainnet', () => {
    const out = paperLoopEnv({
      SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
      MAINNET_OK: '1',
      PATH: '/usr/bin',
    });
    assert.equal(out['SOLANA_RPC_URL'], PAPER_SOLANA_RPC_URL);
    assert.equal(out['MAINNET_OK'], undefined);
    assert.equal(out['PATH'], '/usr/bin');
    assert.match(PAPER_SOLANA_RPC_URL, /devnet/);
  });
});

describe('paper loop contract unchanged', () => {
  it('CLAWD.md stays paper + devnet', () => {
    const cfg = parseClawdConfig(readFileSync(join(ROOT, 'CLAWD.md'), 'utf8'));
    assert.equal(cfg.mode, 'paper');
    assert.equal(cfg.network, 'devnet');
  });
});

describe('handleAgentKitRoute', { concurrency: false }, () => {
  const saved: Record<string, string | undefined> = {};
  const envKeys = ['AGENT_KIT_URL', 'AGENT_BRIDGE_KEY'] as const;

  before(() => {
    for (const k of envKeys) saved[k] = process.env[k];
  });

  after(() => {
    for (const k of envKeys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('unconfigured POST /api/agent/act returns 503 with setup error', async () => {
    delete process.env['AGENT_KIT_URL'];
    delete process.env['AGENT_BRIDGE_KEY'];
    const proxy = await startProxyServer();
    try {
      const res = await fetch(`${proxy.base}/api/agent/act`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: 'do not trade' }),
      });
      assert.equal(res.status, 503);
      const body = (await res.json()) as { error?: string };
      assert.match(
        String(body.error),
        /set AGENT_KIT_URL and AGENT_BRIDGE_KEY/,
      );
    } finally {
      await proxy.close();
    }
  });

  it('configured act forwards instruction and X-Agent-Key to /agent/act', async () => {
    const captured: { key?: string; body?: { instruction?: string } } = {};
    const kitServer = createServer((req, res) => {
      if (req.url === '/agent/act' && req.method === 'POST') {
        let raw = '';
        req.on('data', (c: Buffer) => {
          raw += c.toString('utf8');
        });
        req.on('end', () => {
          captured.key = String(req.headers['x-agent-key'] ?? '');
          captured.body = JSON.parse(raw) as { instruction?: string };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ events: [{ type: 'Message', content: 'ok' }] }));
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    const kit = await listen(kitServer);
    const key = `test-bridge-${Date.now()}`;
    process.env['AGENT_KIT_URL'] = kit.base;
    process.env['AGENT_BRIDGE_KEY'] = key;
    const proxy = await startProxyServer();
    try {
      const instruction = 'do not trade — report public key only';
      const res = await fetch(`${proxy.base}/api/agent/act`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      });
      assert.equal(res.status, 200);
      assert.equal(captured.key, key);
      assert.equal(captured.body?.instruction, instruction);
    } finally {
      await proxy.close();
      await kit.close();
    }
  });

  it('GET /api/agent/status includes default mint and rpcSource from SOLANA_RPC_URL', async () => {
    const prevRpc = process.env['SOLANA_RPC_URL'];
    const injected = `http://127.0.0.1:9${String(Date.now()).slice(-4)}/status-rpc`;
    process.env['SOLANA_RPC_URL'] = injected;
    delete process.env['AGENT_KIT_URL'];
    const proxy = await startProxyServer();
    try {
      const res = await fetch(`${proxy.base}/api/agent/status`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        configured?: boolean;
        targetMint?: string;
        rpc?: string;
        rpcSource?: string;
      };
      assert.equal(body.configured, false);
      assert.equal(body.targetMint, AUTOMATION_TARGET_MINT);
      assert.equal(body.targetMint, '8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump');
      assert.equal(body.rpc, process.env['SOLANA_RPC_URL']);
      assert.equal(body.rpcSource, 'SOLANA_RPC_URL');
    } finally {
      await proxy.close();
      if (prevRpc === undefined) delete process.env['SOLANA_RPC_URL'];
      else process.env['SOLANA_RPC_URL'] = prevRpc;
    }
  });
});
