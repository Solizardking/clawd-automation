#!/usr/bin/env node
/**
 * Clawd Automaton Creator CLI
 *
 * Creator-facing tools for an installed automaton under ~/.automaton.
 * Integrated from Dark Clawd / on-chain-ai-kit automaton packages/cli.
 *
 * Usage: automaton-cli <command> [args]
 */

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  switch (command) {
    case "status":
      await import("./commands/status.js");
      break;
    case "logs":
      await import("./commands/logs.js");
      break;
    case "send":
      await import("./commands/send.js");
      break;
    case "help":
    case undefined:
      console.log(`
Clawd Automaton CLI — Creator Tools

Usage:
  automaton-cli status              Show automaton status from ~/.automaton
  automaton-cli logs [--tail N]     View recent turn logs
  automaton-cli send <to> <msg>     Send a social relay message (if configured)

Runtime package: @onchainai/automation
Bins: automaton · clawd-automaton · automaton-cli
`);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run: automaton-cli help");
      process.exit(1);
  }
}

main().catch((err: Error) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
