import fs from "fs";
import path from "path";
import chalk from "chalk";
import { getWallet, getAutomatonDir } from "../identity/wallet.js";
import { createConfig, saveConfig } from "../config.js";
import { writeDefaultHeartbeatConfig } from "../heartbeat/config.js";
import { showBanner } from "./banner.js";
import { promptRequired, promptMultiline, promptAddress, closePrompts } from "./prompts.js";
import { detectEnvironment } from "./environment.js";
import { generateSoulMd, installDefaultSkills } from "./defaults.js";
export async function runSetupWizard() {
    showBanner();
    console.log(chalk.white("  First-run setup. Let's bring your automaton to life.\n"));
    // ─── 1. Generate wallet ───────────────────────────────────────
    console.log(chalk.cyan("  [1/6] Generating identity (wallet)..."));
    const { account, isNew } = await getWallet();
    if (isNew) {
        console.log(chalk.green(`  Wallet created: ${account.address}`));
    }
    else {
        console.log(chalk.green(`  Wallet loaded: ${account.address}`));
    }
    console.log(chalk.dim(`  Private key stored at: ${getAutomatonDir()}/wallet.json\n`));
    // ─── 2. OpenRouter (inference) ────────────────────────────────
    console.log(chalk.cyan("  [2/6] Inference via OpenRouter (Conway control plane removed)..."));
    let apiKey = process.env.OPENROUTER_API_KEY?.trim() || "";
    if (apiKey) {
        console.log(chalk.green("  OPENROUTER_API_KEY detected in environment.\n"));
    }
    else {
        console.log(chalk.yellow("  Set OPENROUTER_API_KEY for free-router inference (https://openrouter.ai/keys).\n"));
        const manual = await promptRequired("OpenRouter API key (sk-or-…, or Enter to skip)");
        if (manual && manual.startsWith("sk-")) {
            apiKey = manual;
            process.env.OPENROUTER_API_KEY = manual;
            console.log(chalk.green("  OpenRouter key captured for this session.\n"));
        }
        else if (manual) {
            // legacy optional local key
            apiKey = manual;
            const configDir = getAutomatonDir();
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
            }
            fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify({
                apiKey,
                walletAddress: account.address,
                provisionedAt: new Date().toISOString(),
            }, null, 2), { mode: 0o600 });
            console.log(chalk.green("  API key saved.\n"));
        }
    }
    if (!apiKey) {
        console.log(chalk.yellow("  No OpenRouter key yet. Export OPENROUTER_API_KEY before --run.\n"));
    }
    // ─── 3. Interactive questions ─────────────────────────────────
    console.log(chalk.cyan("  [3/6] Setup questions\n"));
    const name = await promptRequired("What do you want to name your automaton?");
    console.log(chalk.green(`  Name: ${name}\n`));
    const genesisPrompt = await promptMultiline("Enter the genesis prompt (system prompt) for your automaton.");
    console.log(chalk.green(`  Genesis prompt set (${genesisPrompt.length} chars)\n`));
    const creatorAddress = await promptAddress("Your Ethereum wallet address (0x...)");
    console.log(chalk.green(`  Creator: ${creatorAddress}\n`));
    // ─── 4. Detect environment ────────────────────────────────────
    console.log(chalk.cyan("  [4/6] Detecting environment..."));
    const env = detectEnvironment();
    if (env.sandboxId) {
        console.log(chalk.green(`  Clawd sandbox detected: ${env.sandboxId}\n`));
    }
    else {
        console.log(chalk.dim(`  Environment: ${env.type} (no sandbox detected)\n`));
    }
    // ─── 5. Write config + heartbeat + SOUL.md + skills ───────────
    console.log(chalk.cyan("  [5/6] Writing configuration..."));
    const config = createConfig({
        name,
        genesisPrompt,
        creatorAddress: creatorAddress,
        registeredWithClawd: !!apiKey,
        sandboxId: env.sandboxId,
        walletAddress: account.address,
        apiKey,
    });
    saveConfig(config);
    console.log(chalk.green("  automaton.json written"));
    writeDefaultHeartbeatConfig();
    console.log(chalk.green("  heartbeat.yml written"));
    // constitution.md (immutable — copied from repo, protected from self-modification)
    const automatonDir = getAutomatonDir();
    const constitutionSrc = path.join(process.cwd(), "constitution.md");
    const constitutionDst = path.join(automatonDir, "constitution.md");
    if (fs.existsSync(constitutionSrc)) {
        fs.copyFileSync(constitutionSrc, constitutionDst);
        fs.chmodSync(constitutionDst, 0o444); // read-only
        console.log(chalk.green("  constitution.md installed (read-only)"));
    }
    // SOUL.md
    const soulPath = path.join(automatonDir, "SOUL.md");
    fs.writeFileSync(soulPath, generateSoulMd(name, account.address, creatorAddress, genesisPrompt), { mode: 0o600 });
    console.log(chalk.green("  SOUL.md written"));
    // Default skills
    const skillsDir = config.skillsDir || "~/.automaton/skills";
    installDefaultSkills(skillsDir);
    console.log(chalk.green("  Default skills installed (clawd-compute, clawd-payments, survival)\n"));
    // ─── 6. Funding guidance ──────────────────────────────────────
    console.log(chalk.cyan("  [6/6] Funding\n"));
    showFundingPanel(account.address);
    closePrompts();
    return config;
}
function showFundingPanel(address) {
    const short = `${address.slice(0, 6)}...${address.slice(-5)}`;
    const w = 58;
    const pad = (s, len) => s + " ".repeat(Math.max(0, len - s.length));
    console.log(chalk.cyan(`  ${"╭" + "─".repeat(w) + "╮"}`));
    console.log(chalk.cyan(`  │${pad("  Fund your automaton", w)}│`));
    console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
    console.log(chalk.cyan(`  │${pad(`  Address: ${short}`, w)}│`));
    console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
    console.log(chalk.cyan(`  │${pad("  1. Export OPENROUTER_API_KEY (free router OK)", w)}│`));
    console.log(chalk.cyan(`  │${pad("     https://openrouter.ai/keys", w)}│`));
    console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
    console.log(chalk.cyan(`  │${pad("  2. Send USDC on Base to the address above (x402)", w)}│`));
    console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
    console.log(chalk.cyan(`  │${pad("  3. Optional: CLAWD_CREDITS_CENTS for local tiers", w)}│`));
    console.log(chalk.cyan(`  │${pad("     https://x402.wtf", w)}│`));
    console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
    console.log(chalk.cyan(`  │${pad("  Local shell + own packages — no Conway required.", w)}│`));
    console.log(chalk.cyan(`  │${pad("  Survival handles low balance gracefully.", w)}│`));
    console.log(chalk.cyan(`  ${"╰" + "─".repeat(w) + "╯"}`));
    console.log("");
}
//# sourceMappingURL=wizard.js.map