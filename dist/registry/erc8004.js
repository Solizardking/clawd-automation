/**
 * ERC-8004 On-Chain Agent Registration
 *
 * Registers the automaton on-chain as a Trustless Agent via ERC-8004.
 * Uses the Identity Registry on Base mainnet.
 *
 * Contract: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (Base)
 * Reputation: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 (Base)
 */
import { createPublicClient, createWalletClient, http, parseAbi, } from "viem";
import { base, baseSepolia } from "viem/chains";
// ─── Contract Addresses ──────────────────────────────────────
const CONTRACTS = {
    mainnet: {
        identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
        reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
        chain: base,
    },
    testnet: {
        identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
        reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
        chain: baseSepolia,
    },
};
// ─── ABI (minimal subset needed for registration) ────────────
const IDENTITY_ABI = parseAbi([
    "function register(string agentURI) external returns (uint256 agentId)",
    "function updateAgentURI(uint256 agentId, string newAgentURI) external",
    "function agentURI(uint256 agentId) external view returns (string)",
    "function ownerOf(uint256 tokenId) external view returns (address)",
    "function totalSupply() external view returns (uint256)",
    "function balanceOf(address owner) external view returns (uint256)",
]);
const REPUTATION_ABI = parseAbi([
    "function leaveFeedback(uint256 agentId, uint8 score, string comment) external",
    "function getFeedback(uint256 agentId) external view returns (tuple(address from, uint8 score, string comment, uint256 timestamp)[])",
]);
/**
 * Register the automaton on-chain with ERC-8004.
 * Returns the agent ID (NFT token ID).
 */
export async function registerAgent(account, agentURI, network = "mainnet", db) {
    const contracts = CONTRACTS[network];
    const chain = contracts.chain;
    const publicClient = createPublicClient({
        chain,
        transport: http(),
    });
    const walletClient = createWalletClient({
        account,
        chain,
        transport: http(),
    });
    // Call register(agentURI)
    const hash = await walletClient.writeContract({
        address: contracts.identity,
        abi: IDENTITY_ABI,
        functionName: "register",
        args: [agentURI],
    });
    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    // Extract agentId from Transfer event logs
    // The register function mints an ERC-721 token
    let agentId = "0";
    for (const log of receipt.logs) {
        if (log.topics.length >= 4) {
            // Transfer(address from, address to, uint256 tokenId)
            agentId = BigInt(log.topics[3]).toString();
            break;
        }
    }
    const entry = {
        agentId,
        agentURI,
        chain: `eip155:${chain.id}`,
        contractAddress: contracts.identity,
        txHash: hash,
        registeredAt: new Date().toISOString(),
    };
    db.setRegistryEntry(entry);
    return entry;
}
/**
 * Update the agent's URI on-chain.
 */
export async function updateAgentURI(account, agentId, newAgentURI, network = "mainnet", db) {
    const contracts = CONTRACTS[network];
    const chain = contracts.chain;
    const walletClient = createWalletClient({
        account,
        chain,
        transport: http(),
    });
    const hash = await walletClient.writeContract({
        address: contracts.identity,
        abi: IDENTITY_ABI,
        functionName: "updateAgentURI",
        args: [BigInt(agentId), newAgentURI],
    });
    // Update in DB
    const entry = db.getRegistryEntry();
    if (entry) {
        entry.agentURI = newAgentURI;
        entry.txHash = hash;
        db.setRegistryEntry(entry);
    }
    return hash;
}
/**
 * Leave reputation feedback for another agent.
 */
export async function leaveFeedback(account, agentId, score, comment, network = "mainnet", db) {
    const contracts = CONTRACTS[network];
    const chain = contracts.chain;
    const walletClient = createWalletClient({
        account,
        chain,
        transport: http(),
    });
    const hash = await walletClient.writeContract({
        address: contracts.reputation,
        abi: REPUTATION_ABI,
        functionName: "leaveFeedback",
        args: [BigInt(agentId), score, comment],
    });
    return hash;
}
/**
 * Query the registry for an agent by ID.
 */
export async function queryAgent(agentId, network = "mainnet") {
    const contracts = CONTRACTS[network];
    const chain = contracts.chain;
    const publicClient = createPublicClient({
        chain,
        transport: http(),
    });
    try {
        const [uri, owner] = await Promise.all([
            publicClient.readContract({
                address: contracts.identity,
                abi: IDENTITY_ABI,
                functionName: "agentURI",
                args: [BigInt(agentId)],
            }),
            publicClient.readContract({
                address: contracts.identity,
                abi: IDENTITY_ABI,
                functionName: "ownerOf",
                args: [BigInt(agentId)],
            }),
        ]);
        return {
            agentId,
            owner: owner,
            agentURI: uri,
        };
    }
    catch {
        return null;
    }
}
/**
 * Get the total number of registered agents.
 */
export async function getTotalAgents(network = "mainnet") {
    const contracts = CONTRACTS[network];
    const chain = contracts.chain;
    const publicClient = createPublicClient({
        chain,
        transport: http(),
    });
    try {
        const supply = await publicClient.readContract({
            address: contracts.identity,
            abi: IDENTITY_ABI,
            functionName: "totalSupply",
        });
        return Number(supply);
    }
    catch {
        return 0;
    }
}
/**
 * Check if an address has a registered agent.
 */
export async function hasRegisteredAgent(address, network = "mainnet") {
    const contracts = CONTRACTS[network];
    const chain = contracts.chain;
    const publicClient = createPublicClient({
        chain,
        transport: http(),
    });
    try {
        const balance = await publicClient.readContract({
            address: contracts.identity,
            abi: IDENTITY_ABI,
            functionName: "balanceOf",
            args: [address],
        });
        return Number(balance) > 0;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=erc8004.js.map