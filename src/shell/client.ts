/**
 * Clawd Shell Client — local runtime (no Conway control plane).
 *
 * exec / filesystem run on the host process. Credits, sandboxes, and
 * domains are local stubs so the agent loop stays offline-capable with
 * OpenRouter + our own packages.
 */

import { exec as cpExec, type ExecOptions } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type {
  ClawdClient,
  ExecResult,
  PortInfo,
  CreateSandboxOptions,
  SandboxInfo,
  PricingTier,
  CreditTransferResult,
  DomainSearchResult,
  DomainRegistration,
  DnsRecord,
  ModelInfo,
} from "../types.js";

const execAsync = promisify(cpExec);

export interface ClawdClientOptions {
  /** Logical host id (local sandbox). Default: local */
  sandboxId?: string;
  /** Starting credit balance in cents for survival tiers. */
  creditsCents?: number;
  /** Working directory for relative paths. */
  cwd?: string;
  /** OpenRouter API key for listModels (optional). */
  openRouterApiKey?: string;
}

export function createClawdClient(
  options: ClawdClientOptions = {},
): ClawdClient {
  const sandboxId = options.sandboxId || process.env.CLAWD_SANDBOX_ID || "local";
  let creditsCents =
    options.creditsCents ??
    (Number(process.env.CLAWD_CREDITS_CENTS) || 100_00); // $100 local default
  const cwd = options.cwd || process.cwd();
  const openRouterApiKey =
    options.openRouterApiKey || process.env.OPENROUTER_API_KEY || "";

  const sandboxes = new Map<string, SandboxInfo>();
  sandboxes.set(sandboxId, {
    id: sandboxId,
    status: "running",
    region: "local",
    vcpu: os.cpus().length,
    memoryMb: Math.round(os.totalmem() / (1024 * 1024)),
    diskGb: 0,
    createdAt: new Date().toISOString(),
  });

  const exec = async (
    command: string,
    timeout?: number,
  ): Promise<ExecResult> => {
    const opts: ExecOptions = {
      cwd,
      timeout: timeout ?? 30_000,
      maxBuffer: 10 * 1024 * 1024,
      shell: "/bin/bash",
      env: process.env,
    };
    try {
      const { stdout, stderr } = await execAsync(command, opts);
      return {
        stdout: typeof stdout === "string" ? stdout : String(stdout ?? ""),
        stderr: typeof stderr === "string" ? stderr : String(stderr ?? ""),
        exitCode: 0,
      };
    } catch (err: any) {
      return {
        stdout: typeof err.stdout === "string" ? err.stdout : String(err.stdout ?? ""),
        stderr:
          (typeof err.stderr === "string" ? err.stderr : String(err.stderr ?? "")) ||
          err.message ||
          "exec failed",
        exitCode: typeof err.code === "number" ? err.code : 1,
      };
    }
  };

  const writeFile = async (filePath: string, content: string): Promise<void> => {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(cwd, filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, "utf-8");
  };

  const readFile = async (filePath: string): Promise<string> => {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(cwd, filePath);
    return fs.readFile(resolved, "utf-8");
  };

  const exposePort = async (port: number): Promise<PortInfo> => {
    return {
      port,
      publicUrl: `http://127.0.0.1:${port}`,
      sandboxId,
    };
  };

  const removePort = async (_port: number): Promise<void> => {};

  const createSandbox = async (
    createOpts: CreateSandboxOptions,
  ): Promise<SandboxInfo> => {
    const id = `local-${Date.now().toString(36)}`;
    const info: SandboxInfo = {
      id,
      status: "running",
      region: createOpts.region || "local",
      vcpu: createOpts.vcpu || 1,
      memoryMb: createOpts.memoryMb || 512,
      diskGb: createOpts.diskGb || 5,
      createdAt: new Date().toISOString(),
    };
    sandboxes.set(id, info);
    return info;
  };

  const deleteSandbox = async (targetId: string): Promise<void> => {
    if (targetId === sandboxId) {
      throw new Error("Cannot delete own local sandbox");
    }
    sandboxes.delete(targetId);
  };

  const listSandboxes = async (): Promise<SandboxInfo[]> => {
    return Array.from(sandboxes.values());
  };

  const getCreditsBalance = async (): Promise<number> => creditsCents;

  const getCreditsPricing = async (): Promise<PricingTier[]> => [
    {
      name: "local",
      vcpu: 1,
      memoryMb: 512,
      diskGb: 5,
      monthlyCents: 0,
    },
  ];

  const transferCredits = async (
    toAddress: string,
    amountCents: number,
    _note?: string,
  ): Promise<CreditTransferResult> => {
    if (amountCents > creditsCents) {
      throw new Error(
        `Insufficient local credits: have ${creditsCents}, need ${amountCents}`,
      );
    }
    creditsCents -= amountCents;
    return {
      transferId: `local_${Date.now().toString(36)}`,
      status: "completed",
      toAddress,
      amountCents,
      balanceAfterCents: creditsCents,
    };
  };

  const searchDomains = async (
    query: string,
    _tlds?: string,
  ): Promise<DomainSearchResult[]> => {
    return [
      {
        domain: query.includes(".") ? query : `${query}.local`,
        available: true,
        registrationPrice: 0,
        currency: "USD",
      },
    ];
  };

  const registerDomain = async (
    domain: string,
    _years: number = 1,
  ): Promise<DomainRegistration> => {
    return {
      domain,
      status: "registered-local",
      expiresAt: new Date(Date.now() + 365 * 864e5).toISOString(),
      transactionId: `local_dom_${Date.now().toString(36)}`,
    };
  };

  const listDnsRecords = async (_domain: string): Promise<DnsRecord[]> => [];

  const addDnsRecord = async (
    _domain: string,
    type: string,
    host: string,
    value: string,
    ttl?: number,
  ): Promise<DnsRecord> => ({
    id: `local_rec_${Date.now().toString(36)}`,
    type,
    host,
    value,
    ttl: ttl || 3600,
  });

  const deleteDnsRecord = async (
    _domain: string,
    _recordId: string,
  ): Promise<void> => {};

  const listModels = async (): Promise<ModelInfo[]> => {
    if (!openRouterApiKey) {
      return [
        {
          id: "openrouter/free",
          provider: "openrouter",
          pricing: { inputPerMillion: 0, outputPerMillion: 0 },
        },
      ];
    }
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${openRouterApiKey}` },
      });
      if (!resp.ok) return [];
      const data = (await resp.json()) as any;
      const raw = data.data || [];
      return raw.slice(0, 50).map((m: any) => ({
        id: m.id,
        provider: m.id?.split("/")[0] || "openrouter",
        pricing: {
          inputPerMillion: Number(m.pricing?.prompt || 0) * 1e6 || 0,
          outputPerMillion: Number(m.pricing?.completion || 0) * 1e6 || 0,
        },
      }));
    } catch {
      return [];
    }
  };

  const client = {
    exec,
    writeFile,
    readFile,
    exposePort,
    removePort,
    createSandbox,
    deleteSandbox,
    listSandboxes,
    getCreditsBalance,
    getCreditsPricing,
    transferCredits,
    searchDomains,
    registerDomain,
    listDnsRecords,
    addDnsRecord,
    deleteDnsRecord,
    listModels,
  } as ClawdClient & {
    __apiUrl: string;
    __apiKey: string;
    __mode: "local";
  };

  client.__apiUrl = "local://clawd";
  client.__apiKey = openRouterApiKey || "local";
  client.__mode = "local";

  return client;
}
