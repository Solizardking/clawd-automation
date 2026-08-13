/**
 * Live/automation Solana JSON-RPC selection.
 *
 * The paper OODA loop (`loop.ts`) must never inherit a mainnet
 * `SOLANA_RPC_URL` from this process — use `paperLoopEnv()` when spawning it.
 */

export const AUTOMATION_TARGET_MINT =
  '8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump';

export const PAPER_SOLANA_RPC_URL = 'https://api.devnet.solana.com';

const PUBLIC_MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

export type RpcSource =
  | 'SOLANA_RPC_URL'
  | 'HELIUS_RPC_URL'
  | 'HELIUS_API_KEY'
  | 'public';

export function rpcSource(env: NodeJS.ProcessEnv = process.env): RpcSource {
  if (env['SOLANA_RPC_URL']?.trim()) return 'SOLANA_RPC_URL';
  if (env['HELIUS_RPC_URL']?.trim()) return 'HELIUS_RPC_URL';
  if (env['HELIUS_API_KEY']?.trim()) return 'HELIUS_API_KEY';
  return 'public';
}

/** JSON-RPC endpoint for live/automation web routes. Prefers SOLANA_RPC_URL. */
export function solanaRpcUrl(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env['SOLANA_RPC_URL']?.trim();
  if (explicit) return explicit;
  const heliusUrl = env['HELIUS_RPC_URL']?.trim();
  if (heliusUrl) return heliusUrl;
  const key = env['HELIUS_API_KEY']?.trim();
  if (key) return `https://mainnet.helius-rpc.com/?api-key=${key}`;
  return PUBLIC_MAINNET_RPC;
}

export function rpcStatusFields(env: NodeJS.ProcessEnv = process.env): {
  rpc: string;
  rpcSource: RpcSource;
  targetMint: string;
} {
  return {
    rpc: solanaRpcUrl(env),
    rpcSource: rpcSource(env),
    targetMint: AUTOMATION_TARGET_MINT,
  };
}

/** Child env for `loop.ts` — always paper/devnet RPC, never MAINNET_OK. */
export function paperLoopEnv(
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env = { ...base };
  env['SOLANA_RPC_URL'] = PAPER_SOLANA_RPC_URL;
  delete env['MAINNET_OK'];
  return env;
}
