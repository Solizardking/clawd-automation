/**
 * ooda/web/agent-kit.ts — Proxy to the OpenClawd Solana Kit's automation
 * bridge (POST /agent/act on the Rust `kit` HTTP service).
 *
 * This is a separate, explicitly-invoked surface from the core OODA loop —
 * loop.ts stays paper + devnet only (see observe.ts / validate.ts). This
 * module is the live-trading counterpart to live.ts: instead of proxying
 * DFlow quotes for a browser wallet to sign, it hands a natural-language
 * instruction to the OpenClawd kit, which can execute a real swap for any
 * SPL token (Jupiter routing, pump.fun) using its own configured wallet
 * (kit's SOLANA_PRIVATE_KEY) and returns the full tool-call trace.
 *
 * Nothing here holds or forwards a private key. It forwards one shared
 * secret (AGENT_BRIDGE_KEY) that this server reads from its own env — the
 * same secret the kit operator configured — so only trusted callers reach
 * the kit's signer-backed endpoint. If AGENT_KIT_URL / AGENT_BRIDGE_KEY are
 * unset, every route below reports unconfigured/502 rather than silently
 * doing nothing.
 */

import type { ServerResponse } from 'node:http';

import { AUTOMATION_TARGET_MINT, rpcStatusFields } from './rpc.js';

export { AUTOMATION_TARGET_MINT } from './rpc.js';

function agentKitBase(): string | undefined {
  const url = process.env['AGENT_KIT_URL']?.trim();
  return url ? url.replace(/\/+$/, '') : undefined;
}

function agentBridgeKey(): string | undefined {
  return process.env['AGENT_BRIDGE_KEY']?.trim() || undefined;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c: Buffer) => { body += c.toString('utf8'); });
    req.on('end', () => resolve(body));
  });
}

/** Handles /api/agent/* routes. Returns true if the request was handled. */
export async function handleAgentKitRoute(
  req: import('node:http').IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  if (url.pathname === '/api/agent/status') {
    const base = agentKitBase();
    const rpc = rpcStatusFields();
    if (!base) {
      sendJson(res, 200, { configured: false, ...rpc });
      return true;
    }
    try {
      const upstream = await fetch(new URL('/agent/health', base));
      const body = (await upstream.json()) as Record<string, unknown>;
      sendJson(res, 200, {
        configured: true,
        url: base,
        bridgeKeyPresent: Boolean(agentBridgeKey()),
        kit: body,
        ...rpc,
      });
    } catch (err) {
      sendJson(res, 502, {
        configured: true,
        url: base,
        error: `agent kit unreachable: ${String(err)}`,
        ...rpc,
      });
    }
    return true;
  }

  if (url.pathname === '/api/agent/act' && req.method === 'POST') {
    const base = agentKitBase();
    const key = agentBridgeKey();
    if (!base || !key) {
      sendJson(res, 503, {
        error: 'agent bridge not configured — set AGENT_KIT_URL and AGENT_BRIDGE_KEY on this server',
      });
      return true;
    }
    let instruction: string;
    let preamble: string | undefined;
    try {
      const parsed = JSON.parse(await readBody(req)) as { instruction?: unknown; preamble?: unknown };
      if (typeof parsed.instruction !== 'string' || !parsed.instruction.trim()) {
        sendJson(res, 400, { error: 'instruction (string) is required' });
        return true;
      }
      instruction = parsed.instruction;
      preamble = typeof parsed.preamble === 'string' ? parsed.preamble : undefined;
    } catch {
      sendJson(res, 400, { error: 'invalid JSON body' });
      return true;
    }
    try {
      const upstream = await fetch(new URL('/agent/act', base), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Agent-Key': key },
        body: JSON.stringify({ instruction, preamble }),
      });
      const body = await upstream.text();
      res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(body);
    } catch (err) {
      sendJson(res, 502, { error: `agent kit request failed: ${String(err)}` });
    }
    return true;
  }

  return false;
}
