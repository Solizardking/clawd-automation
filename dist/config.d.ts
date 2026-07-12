/**
 * Automaton Configuration
 *
 * Loads and saves the automaton's configuration from ~/.automaton/automaton.json
 */
import type { AutomatonConfig } from "./types.js";
import type { Address } from "viem";
export declare function getConfigPath(): string;
/**
 * Load the automaton config from disk.
 * Merges with defaults for any missing fields.
 */
export declare function loadConfig(): AutomatonConfig | null;
/**
 * Save the automaton config to disk.
 */
export declare function saveConfig(config: AutomatonConfig): void;
/**
 * Resolve ~ paths to absolute paths.
 */
export declare function resolvePath(p: string): string;
/**
 * Create a fresh config from setup wizard inputs.
 */
export declare function createConfig(params: {
    name: string;
    genesisPrompt: string;
    creatorMessage?: string;
    creatorAddress: Address;
    registeredWithConway: boolean;
    sandboxId: string;
    walletAddress: Address;
    apiKey: string;
    parentAddress?: Address;
}): AutomatonConfig;
//# sourceMappingURL=config.d.ts.map