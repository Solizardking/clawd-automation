/**
 * X402 CLI - Interactive REPL Engine
 * 
 * Like Claude Code meets Solana — an intelligent agentic terminal
 * that understands DeFi, trading, image generation, and blockchain ops.
 */

const readline = require('readline');
const { executeCommand, getCommandHelp } = require('./commands');

// ═══════════════════════════════════════════
// ANSI Styling
// ═══════════════════════════════════════════
const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const fgRGB = (r, g, b) => `${ESC}38;2;${r};${g};${b}m`;

const PROMPT_COLOR = fgRGB(0, 255, 136);
const ERROR_COLOR = fgRGB(255, 50, 50);
const INFO_COLOR = fgRGB(0, 180, 255);
const WARN_COLOR = fgRGB(255, 200, 0);
const SUCCESS_COLOR = fgRGB(0, 255, 136);
const DIM_COLOR = fgRGB(100, 100, 120);

const SOLANA_GRAD = [
    fgRGB(0, 255, 163),
    fgRGB(50, 200, 200),
    fgRGB(100, 150, 240),
    fgRGB(150, 100, 255),
    fgRGB(180, 50, 255),
];

function gradientText(text, palette) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const ci = Math.floor((i / text.length) * palette.length);
        result += palette[Math.min(ci, palette.length - 1)] + text[i];
    }
    return result + RESET;
}

// ═══════════════════════════════════════════
// History Management
// ═══════════════════════════════════════════
const commandHistory = [];
const MAX_HISTORY = 100;

function addToHistory(cmd) {
    if (cmd.trim() && commandHistory[commandHistory.length - 1] !== cmd) {
        commandHistory.push(cmd);
        if (commandHistory.length > MAX_HISTORY) commandHistory.shift();
    }
}

// ═══════════════════════════════════════════
// Output Formatters
// ═══════════════════════════════════════════
function formatJSON(obj, indent = 2) {
    const json = JSON.stringify(obj, null, indent);
    return json
        .replace(/"([^"]+)":/g, `${fgRGB(0, 200, 255)}"$1"${RESET}:`)
        .replace(/: "([^"]+)"/g, `: ${fgRGB(0, 255, 136)}"$1"${RESET}`)
        .replace(/: (\d+\.?\d*)/g, `: ${fgRGB(255, 200, 0)}$1${RESET}`)
        .replace(/: (true|false)/g, `: ${fgRGB(200, 100, 255)}$1${RESET}`)
        .replace(/: (null)/g, `: ${DIM}null${RESET}`);
}

function printResult(result) {
    if (typeof result === 'string') {
        console.log(`\n  ${result}\n`);
    } else if (typeof result === 'object') {
        console.log(`\n${formatJSON(result)}\n`);
    }
}

function printError(message) {
    console.log(`\n  ${ERROR_COLOR}✖ ${message}${RESET}\n`);
}

function printSuccess(message) {
    console.log(`\n  ${SUCCESS_COLOR}✓ ${message}${RESET}\n`);
}

function printInfo(message) {
    console.log(`  ${INFO_COLOR}ℹ ${message}${RESET}`);
}

function printWarn(message) {
    console.log(`  ${WARN_COLOR}⚠ ${message}${RESET}`);
}

// ═══════════════════════════════════════════
// Spinner
// ═══════════════════════════════════════════
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerInterval = null;
let spinnerFrame = 0;

function startSpinner(message = 'Processing') {
    spinnerFrame = 0;
    spinnerInterval = setInterval(() => {
        const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];
        process.stdout.write(`\r  ${PROMPT_COLOR}${frame}${RESET} ${DIM}${message}...${RESET}`);
        spinnerFrame++;
    }, 80);
}

function stopSpinner(success = true) {
    if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
        const icon = success ? `${SUCCESS_COLOR}✓` : `${ERROR_COLOR}✖`;
        process.stdout.write(`\r  ${icon}${RESET}                                          \n`);
    }
}

// ═══════════════════════════════════════════
// Tab Completion
// ═══════════════════════════════════════════
const COMMANDS = [
    // AI & Image
    'ask', 'chat', 'think', 'code', 'image', 'banana', 'sticker', 'logo', 'weather', 'article',
    // Birdeye Stats
    'price', 'overview', 'metadata', 'meta-multi', 'market', 'market-multi',
    'tradedata', 'tradedata-multi', 'liquidity', 'liquidity-multi',
    'pair', 'pair-multi', 'pricestats', 'pricestats-multi',
    // Token Lists
    'token-list', 'top-volume', 'top-gainers', 'new-listings', 'token-markets', 'trending',
    // Transactions
    'trades', 'trades-all', 'trades-pair', 'trader-txs', 'whales', 'mint-burn',
    // Wallet
    'wallet', 'networth', 'pnl', 'wallet-balance', 'trader-profile',
    // Security, Holders, Search
    'holders', 'security', 'search', 'creation', 'meme', 'networks',
    // Charts & Intel
    'ohlcv', 'sentiment', 'whale-alerts', 'intel', 'compare', 'analytics', 'x402-intel',
    // Solana & Portfolio
    'balance', 'tokens', 'portfolio', 'supply', 'trade',
    // Agents & System
    'council', 'invest', 'status', 'config', 'env', 'server',
    // Built-ins
    'help', 'clear', 'exit', 'quit', 'history',
];

function completer(line) {
    const completions = COMMANDS.filter(c => c.startsWith(line.toLowerCase()));
    return [completions.length ? completions : COMMANDS, line];
}

// ═══════════════════════════════════════════
// Interactive REPL
// ═══════════════════════════════════════════
async function startREPL() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer,
        terminal: true,
        historySize: MAX_HISTORY,
        prompt: `  ${gradientText('x402', SOLANA_GRAD)} ${DIM}›${RESET} `,
    });

    // Populate readline history
    for (const h of commandHistory) {
        rl.history.push(h);
    }

    console.log(`  ${DIM}Type ${BOLD}help${RESET}${DIM} for commands, ${BOLD}exit${RESET}${DIM} to quit${RESET}`);
    rl.prompt();

    rl.on('line', async (line) => {
        const input = line.trim();

        if (!input) {
            rl.prompt();
            return;
        }

        addToHistory(input);

        // Built-in commands
        if (input === 'exit' || input === 'quit' || input === 'q') {
            console.log(`\n  ${gradientText('▸ X402 Agent signing off. Stay sovereign. ◆', SOLANA_GRAD)}\n`);
            process.exit(0);
        }

        if (input === 'clear' || input === 'cls') {
            process.stdout.write(`${ESC}2J${ESC}H`);
            rl.prompt();
            return;
        }

        if (input === 'help' || input === '?') {
            console.log(getCommandHelp());
            rl.prompt();
            return;
        }

        if (input === 'history') {
            console.log('');
            commandHistory.forEach((h, i) => {
                console.log(`  ${DIM}${(i + 1).toString().padStart(3)}${RESET}  ${h}`);
            });
            console.log('');
            rl.prompt();
            return;
        }

        // Parse command and args
        const parts = input.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const command = parts[0].toLowerCase();
        const cmdArgs = parts.slice(1).map(a => a.replace(/^"|"$/g, ''));

        try {
            startSpinner(`Running ${command}`);
            const result = await executeCommand(command, cmdArgs, {});
            stopSpinner(true);

            if (result !== undefined && result !== null) {
                printResult(result);
            }
        } catch (error) {
            stopSpinner(false);
            printError(error.message);
        }

        rl.prompt();
    });

    rl.on('close', () => {
        console.log(`\n  ${gradientText('▸ X402 out. ◆', SOLANA_GRAD)}\n`);
        process.exit(0);
    });
}

module.exports = { startREPL, printResult, printError, printSuccess, printInfo, printWarn, startSpinner, stopSpinner, formatJSON, gradientText };
