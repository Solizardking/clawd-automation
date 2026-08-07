/**
 * automaton-cli send <to-address> "message text"
 *
 * Optional social relay — uses SOCIAL_RELAY_URL when set.
 */

import { loadConfig } from "@onchainai/automation/config.js";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";

const args = process.argv.slice(3);
const toAddress = args[0];
const messageText = args.slice(1).join(" ");

if (!toAddress || !messageText) {
  console.log("Usage: automaton-cli send <to-address> <message>");
  process.exit(1);
}

const walletPath = path.join(
  process.env.HOME || "/root",
  ".automaton",
  "wallet.json",
);

if (!fs.existsSync(walletPath)) {
  console.log("No wallet found at ~/.automaton/wallet.json");
  console.log("Run: automaton --init");
  process.exit(1);
}

const walletData = JSON.parse(fs.readFileSync(walletPath, "utf-8")) as {
  privateKey: string;
};
const account = privateKeyToAccount(walletData.privateKey as `0x${string}`);

const config = loadConfig();
const relayUrl =
  (config as { socialRelayUrl?: string } | null)?.socialRelayUrl ||
  process.env.SOCIAL_RELAY_URL ||
  "";

if (!relayUrl) {
  console.log(
    "No social relay configured. Set SOCIAL_RELAY_URL or config.socialRelayUrl.",
  );
  process.exit(1);
}

try {
  const resp = await fetch(`${relayUrl}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: account.address,
      to: toAddress,
      content: messageText,
      signed_at: new Date().toISOString(),
    }),
  });

  if (!resp.ok) {
    throw new Error(`Relay returned ${resp.status}: ${await resp.text()}`);
  }

  const result = (await resp.json()) as { id?: string };
  console.log(`Message sent.`);
  console.log(`  ID:    ${result.id || "n/a"}`);
  console.log(`  From:  ${account.address}`);
  console.log(`  To:    ${toAddress}`);
  console.log(`  Relay: ${relayUrl}`);
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Failed to send message: ${msg}`);
  process.exit(1);
}
