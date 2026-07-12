#!/usr/bin/env node
/**
 * Clawd Automaton Runtime
 *
 * The entry point for the sovereign AI agent.
 * Handles CLI args, bootstrapping, and orchestrating
 * the heartbeat daemon + agent loop.
 */
import { getWallet, getAutomatonDir } from "./identity/wallet.js";
import { provision, loadApiKeyFromConfig } from "./identity/provision.js";
import { loadConfig, resolvePath } from "./config.js";
import { createDatabase } from "./state/database.js";
import { createClawdClient } from "./shell/client.js";
import { resolveInferenceClient } from "./inference/resolve.js";
import { createHeartbeatDaemon } from "./heartbeat/daemon.js";
import { loadHeartbeatConfig, syncHeartbeatToDb, } from "./heartbeat/config.js";
import { runAgentLoop } from "./agent/loop.js";
import { loadSkills } from "./skills/loader.js";
import { initStateRepo } from "./git/state-versioning.js";
import { createSocialClient } from "./social/client.js";
import { createRuntimeContext, toHeartbeatOptions, } from "./runtime/context.js";
import { getCjsHealth } from "./interop/cjs-bridge.js";
const VERSION = "0.1.0";
async function main() {
    const args = process.argv.slice(2);
    // ─── CLI Commands ────────────────────────────────────────────
    if (args.includes("--version") || args.includes("-v")) {
        console.log(`Clawd Automaton v${VERSION}`);
        process.exit(0);
    }
    if (args.includes("--help") || args.includes("-h")) {
        console.log(`
Clawd Automaton v${VERSION}
Sovereign AI Agent Runtime

Usage:
  automaton --run          Start the automaton (first run triggers setup wizard)
  automaton --setup        Re-run the interactive setup wizard
  automaton --init         Initialize wallet and config directory
  automaton --provision    Optional legacy SIWE key (not required for OpenRouter)
  automaton --status       Show current automaton status
  automaton --version      Show version
  automaton --help         Show this help

Environment:
  OPENROUTER_API_KEY       Required — OpenRouter API key (free router supported)
  OPENROUTER_FREE_MODEL    Free model / router (default: openrouter/free)
  OPENROUTER_MODEL         Default OpenRouter model (defaults to free model)
  OPENROUTER_PROVIDER_SORT Optional: price | throughput | latency
  INFERENCE_PROVIDER       auto | openrouter (OpenRouter only; Conway removed)
  CLAWD_SANDBOX_ID         Local sandbox id (default: local)
  CLAWD_CREDITS_CENTS      Local survival credits balance (default: 10000)
`);
        process.exit(0);
    }
    if (args.includes("--init")) {
        const { account, isNew } = await getWallet();
        console.log(JSON.stringify({
            address: account.address,
            isNew,
            configDir: getAutomatonDir(),
        }));
        process.exit(0);
    }
    if (args.includes("--provision")) {
        try {
            const result = await provision();
            console.log(JSON.stringify(result));
        }
        catch (err) {
            console.error(`Provision failed: ${err.message}`);
            process.exit(1);
        }
        process.exit(0);
    }
    if (args.includes("--status")) {
        await showStatus();
        process.exit(0);
    }
    if (args.includes("--setup")) {
        const { runSetupWizard } = await import("./setup/wizard.js");
        await runSetupWizard();
        process.exit(0);
    }
    if (args.includes("--run")) {
        await run();
        return;
    }
    // Default: show help
    console.log('Run "automaton --help" for usage information.');
    console.log('Run "automaton --run" to start the automaton.');
}
// ─── Status Command ────────────────────────────────────────────
async function showStatus() {
    const config = loadConfig();
    if (!config) {
        console.log("Automaton is not configured. Run the setup script first.");
        return;
    }
    const dbPath = resolvePath(config.dbPath);
    const db = createDatabase(dbPath);
    const state = db.getAgentState();
    const turnCount = db.getTurnCount();
    const tools = db.getInstalledTools();
    const heartbeats = db.getHeartbeatEntries();
    const skills = db.getSkills(true);
    const children = db.getChildren();
    const registry = db.getRegistryEntry();
    console.log(`
=== AUTOMATON STATUS ===
Name:       ${config.name}
Address:    ${config.walletAddress}
Creator:    ${config.creatorAddress}
Sandbox:    ${config.sandboxId}
State:      ${state}
Turns:      ${turnCount}
Tools:      ${tools.length} installed
Skills:     ${skills.length} active
Heartbeats: ${heartbeats.filter((h) => h.enabled).length} active
Children:   ${children.filter((c) => c.status !== "dead").length} alive / ${children.length} total
Agent ID:   ${registry?.agentId || "not registered"}
Model:      ${config.inferenceModel}
Version:    ${config.version}
========================
`);
    db.close();
}
// ─── Main Run ──────────────────────────────────────────────────
async function run() {
    console.log(`[${new Date().toISOString()}] Clawd Automaton v${VERSION} starting...`);
    // Load config — first run triggers interactive setup wizard
    let config = loadConfig();
    if (!config) {
        const { runSetupWizard } = await import("./setup/wizard.js");
        config = await runSetupWizard();
    }
    // Load wallet
    const { account } = await getWallet();
    const apiKey = config.clawdApiKey ||
        loadApiKeyFromConfig() ||
        process.env.OPENROUTER_API_KEY ||
        "local";
    const sandboxId = config.sandboxId || process.env.CLAWD_SANDBOX_ID || "local";
    // Build identity
    const identity = {
        name: config.name,
        address: account.address,
        account,
        creatorAddress: config.creatorAddress,
        sandboxId,
        apiKey,
        createdAt: new Date().toISOString(),
    };
    // Initialize database
    const dbPath = resolvePath(config.dbPath);
    const db = createDatabase(dbPath);
    // Store identity in DB
    db.setIdentity("name", config.name);
    db.setIdentity("address", account.address);
    db.setIdentity("creator", config.creatorAddress);
    db.setIdentity("sandbox", sandboxId);
    // Local Clawd shell (host process — no Conway control plane)
    const clawd = createClawdClient({
        sandboxId,
        openRouterApiKey: process.env.OPENROUTER_API_KEY,
    });
    console.log(`[${new Date().toISOString()}] Shell: local clawd sandbox=${sandboxId}`);
    // Inference: OpenRouter only (free router when OPENROUTER_FREE_MODEL set)
    const resolvedInference = resolveInferenceClient({
        model: config.inferenceModel,
        maxTokens: config.maxTokensPerTurn,
    });
    const inference = resolvedInference.client;
    console.log(`[${new Date().toISOString()}] Inference backend: ${resolvedInference.backend} (${resolvedInference.detail})`);
    // Create social client
    let social;
    if (config.socialRelayUrl) {
        social = createSocialClient(config.socialRelayUrl, account);
        console.log(`[${new Date().toISOString()}] Social relay: ${config.socialRelayUrl}`);
    }
    // Load and sync heartbeat config
    const heartbeatConfigPath = resolvePath(config.heartbeatConfigPath);
    const heartbeatConfig = loadHeartbeatConfig(heartbeatConfigPath);
    syncHeartbeatToDb(heartbeatConfig, db);
    // Load skills
    const skillsDir = config.skillsDir || "~/.automaton/skills";
    let skills = [];
    try {
        skills = loadSkills(skillsDir, db);
        console.log(`[${new Date().toISOString()}] Loaded ${skills.length} skills.`);
    }
    catch (err) {
        console.warn(`[${new Date().toISOString()}] Skills loading failed: ${err.message}`);
    }
    // Shared runtime context — one bag for loop, heartbeat, and tools
    let runtime = createRuntimeContext({
        identity,
        config,
        db,
        clawd,
        inference,
        social,
        skills,
    });
    // Probe CJS interop bridge (non-fatal; heavy deps may be missing)
    try {
        const cjsHealth = getCjsHealth();
        console.log(`[${new Date().toISOString()}] CJS bridge: ${cjsHealth.available.length} available, ${cjsHealth.unavailable.length} unavailable`);
    }
    catch (err) {
        console.warn(`[${new Date().toISOString()}] CJS bridge probe failed: ${err.message}`);
    }
    // Initialize state repo (git)
    try {
        await initStateRepo(clawd);
        console.log(`[${new Date().toISOString()}] State repo initialized.`);
    }
    catch (err) {
        console.warn(`[${new Date().toISOString()}] State repo init failed: ${err.message}`);
    }
    // Start heartbeat daemon from the same shared context
    const heartbeat = createHeartbeatDaemon({
        ...toHeartbeatOptions(runtime),
        onWakeRequest: (reason) => {
            console.log(`[HEARTBEAT] Wake request: ${reason}`);
            // The heartbeat can trigger the agent loop
            // In the main run loop, we check for wake requests
            db.setKV("wake_request", reason);
        },
    });
    heartbeat.start();
    console.log(`[${new Date().toISOString()}] Heartbeat daemon started.`);
    // Handle graceful shutdown
    const shutdown = () => {
        console.log(`[${new Date().toISOString()}] Shutting down...`);
        heartbeat.stop();
        db.setAgentState("sleeping");
        db.close();
        process.exit(0);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
    // ─── Main Run Loop ──────────────────────────────────────────
    // The automaton alternates between running and sleeping.
    // The heartbeat can wake it up.
    while (true) {
        try {
            // Reload skills (may have changed since last loop) into shared context
            try {
                skills = loadSkills(skillsDir, db);
                runtime = createRuntimeContext({
                    identity,
                    config,
                    db,
                    clawd,
                    inference,
                    social,
                    skills,
                });
            }
            catch { }
            // Run the agent loop with the same runtime objects + tools registry
            await runAgentLoop({
                identity: runtime.identity,
                config: runtime.config,
                db: runtime.db,
                clawd: runtime.clawd,
                inference: runtime.inference,
                social: runtime.social,
                skills: runtime.skills,
                tools: runtime.tools,
                onStateChange: (state) => {
                    console.log(`[${new Date().toISOString()}] State: ${state}`);
                },
                onTurnComplete: (turn) => {
                    console.log(`[${new Date().toISOString()}] Turn ${turn.id}: ${turn.toolCalls.length} tools, ${turn.tokenUsage.totalTokens} tokens`);
                },
            });
            // Agent loop exited (sleeping or dead)
            const state = db.getAgentState();
            if (state === "dead") {
                console.log(`[${new Date().toISOString()}] Automaton is dead. Heartbeat will continue.`);
                // In dead state, we just wait for funding
                // The heartbeat will keep checking and broadcasting distress
                await sleep(300_000); // Check every 5 minutes
                continue;
            }
            if (state === "sleeping") {
                const sleepUntilStr = db.getKV("sleep_until");
                const sleepUntil = sleepUntilStr
                    ? new Date(sleepUntilStr).getTime()
                    : Date.now() + 60_000;
                const sleepMs = Math.max(sleepUntil - Date.now(), 10_000);
                console.log(`[${new Date().toISOString()}] Sleeping for ${Math.round(sleepMs / 1000)}s`);
                // Sleep, but check for wake requests periodically
                const checkInterval = Math.min(sleepMs, 30_000);
                let slept = 0;
                while (slept < sleepMs) {
                    await sleep(checkInterval);
                    slept += checkInterval;
                    // Check for wake request from heartbeat
                    const wakeRequest = db.getKV("wake_request");
                    if (wakeRequest) {
                        console.log(`[${new Date().toISOString()}] Woken by heartbeat: ${wakeRequest}`);
                        db.deleteKV("wake_request");
                        db.deleteKV("sleep_until");
                        break;
                    }
                }
                // Clear sleep state
                db.deleteKV("sleep_until");
                continue;
            }
        }
        catch (err) {
            console.error(`[${new Date().toISOString()}] Fatal error in run loop: ${err.message}`);
            // Wait before retrying
            await sleep(30_000);
        }
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// ─── Entry Point ───────────────────────────────────────────────
main().catch((err) => {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map