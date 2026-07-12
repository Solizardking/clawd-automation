/**
 * Social Client Factory
 *
 * Creates a SocialClient for the automaton runtime.
 * Self-contained: uses viem for signing and fetch for HTTP.
 */
import { type PrivateKeyAccount } from "viem";
import type { SocialClientInterface } from "../types.js";
/**
 * Create a SocialClient wired to the agent's wallet.
 */
export declare function createSocialClient(relayUrl: string, account: PrivateKeyAccount): SocialClientInterface;
//# sourceMappingURL=client.d.ts.map