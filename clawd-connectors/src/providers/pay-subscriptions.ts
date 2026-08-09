/**
 * Clawd Connectors — Pay Subscriptions (MPP subscription delegations)
 *
 * Wraps the `pay subscriptions` CLI so agents can activate, list, inspect,
 * refresh, and cancel MPP subscription delegations on Solana.
 *
 * Reference: `pay subscriptions --help`
 *   list     List subscriptions across every account, or filter by --account/--network
 *   status   Show detail for a single subscription by its base58 subscription id
 *   new      Activate a new subscription against an explicit on-chain Plan PDA
 *   cancel   Cancel a subscription by its base58 subscription id
 *   refresh  Backfill missing on-chain data on local entries
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface PaySubscriptionsOptions {
  payBinary?: string;
  account?: string;
  network?: string;
}

export interface SubscriptionEntry {
  subscription_id?: string;
  plan?: string;
  mint?: string;
  recipient?: string;
  puller?: string;
  amount?: string;
  period_count?: number | string;
  period_unit?: string;
  status?: string;
  activation_signature?: string;
  [key: string]: unknown;
}

export interface SubscriptionListResult {
  ok: boolean;
  entries: SubscriptionEntry[];
  raw: string;
  error?: string;
}

export interface SubscriptionStatusResult {
  ok: boolean;
  entry: SubscriptionEntry | null;
  raw: string;
  error?: string;
}

export interface SubscriptionActionResult {
  ok: boolean;
  raw: string;
  error?: string;
}

async function runPay(
  args: string[],
  options: PaySubscriptionsOptions,
): Promise<{ stdout: string; stderr: string }> {
  const bin = options.payBinary ?? 'pay';
  const extra: string[] = [];
  if (options.account) extra.push('--account', options.account);
  if (options.network) extra.push('--network', options.network);

  try {
    const result = await execFileAsync(bin, [...extra, ...args], {
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  } catch (err: unknown) {
    const e = err as { stdout?: unknown; stderr?: unknown; message?: string };
    return {
      stdout: e?.stdout ? String(e.stdout).trim() : '',
      stderr: e?.stderr ? String(e.stderr).trim() : (e?.message ?? 'pay failed'),
    };
  }
}

/** Parse CLI table output into objects by header order. */
function parseTable(stdout: string): SubscriptionEntry[] {
  const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(/\s{2,}/).map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const entries: SubscriptionEntry[] = [];
  for (const line of lines.slice(1)) {
    if (line.startsWith('---') || line.trim() === '') continue;
    const cells = line.split(/\s{2,}/).map((c) => c.trim());
    const entry: SubscriptionEntry = {};
    headers.forEach((h, i) => {
      if (i < cells.length) entry[h] = cells[i];
    });
    entries.push(entry);
  }
  return entries;
}

function parseOutput(stdout: string): SubscriptionEntry[] {
  try {
    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed)) return parsed as SubscriptionEntry[];
    if (parsed && Array.isArray((parsed as any).subscriptions)) {
      return (parsed as any).subscriptions as SubscriptionEntry[];
    }
    return [parsed as SubscriptionEntry];
  } catch {
    return parseTable(stdout);
  }
}

export class PaySubscriptions {
  private opts: PaySubscriptionsOptions;

  constructor(opts: PaySubscriptionsOptions = {}) {
    this.opts = opts;
  }

  async list(): Promise<SubscriptionListResult> {
    const args = ['subscriptions', 'list'];
    if (this.opts.network) args.push('--network', this.opts.network);
    if (this.opts.account) args.push('--account', this.opts.account);
    const { stdout, stderr } = await runPay(args, this.opts);
    if (stderr && !stdout) {
      return { ok: false, entries: [], raw: stderr, error: stderr };
    }
    return { ok: true, entries: parseOutput(stdout), raw: stdout };
  }

  async status(subscriptionId: string): Promise<SubscriptionStatusResult> {
    const { stdout, stderr } = await runPay(
      ['subscriptions', 'status', subscriptionId],
      this.opts,
    );
    if (stderr && !stdout) {
      return { ok: false, entry: null, raw: stderr, error: stderr };
    }
    const entries = parseOutput(stdout);
    return { ok: true, entry: entries[0] ?? null, raw: stdout };
  }

  async refresh(): Promise<SubscriptionActionResult> {
    const result = await runPay(['subscriptions', 'refresh'], this.opts);
    return { ok: !result.stderr || !!result.stdout, raw: result.stdout || result.stderr };
  }

  async cancel(
    subscriptionId: string,
    opts: { localOnly?: boolean; viaGateway?: string } = {},
  ): Promise<SubscriptionActionResult> {
    const args = ['subscriptions', 'cancel', subscriptionId];
    if (opts.localOnly) args.push('--local-only');
    if (opts.viaGateway) args.push('--via-gateway', opts.viaGateway);
    const result = await runPay(args, this.opts);
    return { ok: !result.stderr || !!result.stdout, raw: result.stdout || result.stderr };
  }

  async newSubscription(params: {
    plan: string;
    mint: string;
    puller: string;
    recipient: string;
    amount: string;
    period: string;
  }): Promise<SubscriptionActionResult> {
    const args = [
      'subscriptions', 'new',
      '--plan', params.plan,
      '--mint', params.mint,
      '--puller', params.puller,
      '--recipient', params.recipient,
      '--amount', params.amount,
      '--period', params.period,
    ];
    const result = await runPay(args, this.opts);
    return { ok: !result.stderr || !!result.stdout, raw: result.stdout || result.stderr };
  }

  async help(): Promise<SubscriptionActionResult> {
    const result = await runPay(['subscriptions'], this.opts);
    return { ok: true, raw: result.stdout || result.stderr };
  }
}