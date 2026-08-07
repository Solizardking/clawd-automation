/**
 * ZK Primitives integration surface for the Automaton runtime.
 *
 * Loads MANIFEST.json from the repo-local zk-primitives/ tree and exposes
 * observer-safe health + catalog helpers. Transaction signing stays outside
 * this module (trust gate: observer → dry-run → delegated).
 *
 * Path notes:
 * - Works from src/zk (tsx/dev) and dist/zk (compiled) by walking up for MANIFEST.json.
 * - Optional client import is best-effort; missing build of @clawd/zk-client is non-fatal.
 */
export interface ZkManifest {
    schemaVersion?: number;
    name?: string;
    slug?: string;
    status?: string;
    category?: string;
    description?: string;
    packages?: Record<string, {
        name?: string;
        path?: string;
        programId?: string;
    }>;
    operations?: string[];
    environment?: {
        requiredForOnchainActions?: string[];
        optional?: string[];
    };
    trustGate?: Record<string, string>;
    roots?: Record<string, string>;
    docs?: Record<string, string>;
    [key: string]: unknown;
}
export interface ZkHealthReport {
    ok: boolean;
    root: string | null;
    manifest: ZkManifest | null;
    present: {
        manifest: boolean;
        client: boolean;
        agent: boolean;
        programs: boolean;
        docs: boolean;
        zkMd: boolean;
    };
    operations: string[];
    programId: string | null;
    trustGate: Record<string, string>;
    env: {
        required: Array<{
            name: string;
            set: boolean;
        }>;
        optionalSet: string[];
    };
    timestamp: string;
    error?: string;
}
/**
 * Locate zk-primitives root (directory containing MANIFEST.json).
 *
 * Resolution order:
 * 1. CLAWDBOT_ZK_PRIMITIVES_DIR / CLAWD_ZK_PRIMITIVES_DIR (explicit override)
 * 2. fromDir layout: src/zk or dist/zk → ../../zk-primitives
 * 3. process.cwd()/zk-primitives
 * 4. Walk parents of fromDir looking for zk-primitives/MANIFEST.json
 */
export declare function resolveZkPrimitivesRoot(fromDir?: string): string | null;
/**
 * Load and parse MANIFEST.json from the zk-primitives tree.
 */
export declare function loadZkManifest(root?: string | null): ZkManifest | null;
/**
 * Observer-safe health report for the ZK subsystem.
 * Never signs or submits transactions.
 */
export declare function getZkHealth(): ZkHealthReport;
/**
 * Catalog summary suitable for tools / system prompts (JSON-serializable).
 */
export declare function getZkCatalog(): {
    name: string;
    status: string;
    description: string;
    root: string | null;
    programId: string | null;
    operations: string[];
    packages: Record<string, string>;
    docs: string[];
    trustGate: Record<string, string>;
};
/**
 * Read-only reference snippet for system prompts (constitution-aligned).
 */
export declare function getZkPromptContext(): string;
//# sourceMappingURL=primitives.d.ts.map