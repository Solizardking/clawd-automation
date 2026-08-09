/**
 * ooda/web/live.ts — Live (mainnet) trading proxy: DFlow quotes/orders + Helius confirmation.
 *
 * This module never holds a private key and never signs or broadcasts a
 * transaction. It only:
 *   - proxies DFlow's /order endpoint (the Trading API has no CORS, so
 *     browsers must go through a backend) to fetch quotes + unsigned txs
 *   - checks confirmation status via Helius RPC (falls back to the public
 *     mainnet-beta RPC if no Helius key is configured)
 *
 * The connected browser wallet (Wallet Standard / Phantom) signs and
 * broadcasts every transaction itself — real funds only move when the user
 * approves the wallet's own popup.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

const DFLOW_PROD_BASE = 'https://quote-api.dflow.net';
const DFLOW_DEV_BASE = 'https://dev-quote-api.dflow.net';

function dflowHost(): { base: string; apiKey?: string; mode: 'prod' | 'dev' } {
  const apiKey = process.env['DFLOW_API_KEY']?.trim();
  return apiKey
    ? { base: DFLOW_PROD_BASE, apiKey, mode: 'prod' }
    : { base: DFLOW_DEV_BASE, mode: 'dev' };
}

function heliusRpcUrl(): string {
  const explicit = process.env['HELIUS_RPC_URL']?.trim();
  if (explicit) return explicit;
  const key = process.env['HELIUS_API_KEY']?.trim();
  if (key) return `https://mainnet.helius-rpc.com/?api-key=${key}`;
  return 'https://api.mainnet-beta.solana.com';
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

let loggedHost = false;

interface SignatureStatusValue {
  confirmationStatus?: string;
  err?: unknown;
  slot?: number;
}

/** Handles /api/live/* routes. Returns true if the request was handled. */
export async function handleLiveRoute(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  if (url.pathname === '/api/live/status') {
    const { mode, apiKey } = dflowHost();
    sendJson(res, 200, {
      dflow: mode,
      dflowKeyPresent: Boolean(apiKey),
      helius: Boolean(process.env['HELIUS_RPC_URL'] || process.env['HELIUS_API_KEY']),
    });
    return true;
  }

  if (url.pathname === '/api/live/order') {
    const { base, apiKey, mode } = dflowHost();
    if (!loggedHost) {
      process.stdout.write(
        `[ooda-web/live] DFlow host=${mode} (${base}) key=${apiKey ? 'present' : 'absent'}\n`,
      );
      loggedHost = true;
    }
    const upstream = new URL('/order', base);
    for (const [k, v] of url.searchParams) upstream.searchParams.set(k, v);
    try {
      const upstreamRes = await fetch(upstream, {
        headers: apiKey ? { 'x-api-key': apiKey } : {},
      });
      const body = await upstreamRes.text();
      res.writeHead(upstreamRes.status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(body);
    } catch (err) {
      sendJson(res, 502, { error: `DFlow request failed: ${String(err)}` });
    }
    return true;
  }

  if (url.pathname === '/api/live/confirm') {
    const signature = url.searchParams.get('signature');
    if (!signature) {
      sendJson(res, 400, { error: 'signature query param required' });
      return true;
    }
    try {
      const rpcRes = await fetch(heliusRpcUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignatureStatuses',
          params: [[signature], { searchTransactionHistory: true }],
        }),
      });
      const json = (await rpcRes.json()) as {
        result?: { value?: Array<SignatureStatusValue | null> };
        error?: { message?: string };
      };
      if (json.error) {
        sendJson(res, 502, { error: json.error.message ?? 'RPC error' });
        return true;
      }
      const status = json.result?.value?.[0] ?? null;
      sendJson(res, 200, {
        signature,
        found: Boolean(status),
        confirmationStatus: status?.confirmationStatus ?? null,
        err: status?.err ?? null,
        slot: status?.slot ?? null,
      });
    } catch (err) {
      sendJson(res, 502, { error: `RPC request failed: ${String(err)}` });
    }
    return true;
  }

  return false;
}
