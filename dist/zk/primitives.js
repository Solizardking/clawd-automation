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
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Locate zk-primitives root (directory containing MANIFEST.json).
 *
 * Resolution order:
 * 1. CLAWDBOT_ZK_PRIMITIVES_DIR / CLAWD_ZK_PRIMITIVES_DIR (explicit override)
 * 2. fromDir layout: src/zk or dist/zk → ../../zk-primitives
 * 3. process.cwd()/zk-primitives
 * 4. Walk parents of fromDir looking for zk-primitives/MANIFEST.json
 */
export function resolveZkPrimitivesRoot(fromDir = __dirname) {
    const candidates = [];
    // Explicit env overrides win (catalogIntegration.zkRootEnv).
    if (process.env.CLAWDBOT_ZK_PRIMITIVES_DIR) {
        candidates.push(path.resolve(process.env.CLAWDBOT_ZK_PRIMITIVES_DIR));
    }
    if (process.env.CLAWD_ZK_PRIMITIVES_DIR) {
        candidates.push(path.resolve(process.env.CLAWD_ZK_PRIMITIVES_DIR));
    }
    // Compiled (dist/zk) or source (src/zk) → monorepo root sibling.
    candidates.push(path.resolve(fromDir, "..", "..", "zk-primitives"));
    // cwd-relative (npm scripts, smoke from repo root).
    candidates.push(path.resolve(process.cwd(), "zk-primitives"));
    // Walk parents of fromDir for nested install layouts.
    let walk = path.resolve(fromDir);
    for (let i = 0; i < 8; i++) {
        candidates.push(path.join(walk, "zk-primitives"));
        const parent = path.dirname(walk);
        if (parent === walk)
            break;
        walk = parent;
    }
    const seen = new Set();
    for (const candidate of candidates) {
        if (!candidate || seen.has(candidate))
            continue;
        seen.add(candidate);
        if (existsSync(path.join(candidate, "MANIFEST.json"))) {
            return candidate;
        }
    }
    return null;
}
/**
 * Load and parse MANIFEST.json from the zk-primitives tree.
 */
export function loadZkManifest(root) {
    const zkRoot = root ?? resolveZkPrimitivesRoot();
    if (!zkRoot)
        return null;
    const manifestPath = path.join(zkRoot, "MANIFEST.json");
    if (!existsSync(manifestPath))
        return null;
    try {
        return JSON.parse(readFileSync(manifestPath, "utf-8"));
    }
    catch {
        return null;
    }
}
function envSet(name) {
    const v = process.env[name];
    return typeof v === "string" && v.trim().length > 0;
}
/**
 * Observer-safe health report for the ZK subsystem.
 * Never signs or submits transactions.
 */
export function getZkHealth() {
    const timestamp = new Date().toISOString();
    const root = resolveZkPrimitivesRoot();
    if (!root) {
        return {
            ok: false,
            root: null,
            manifest: null,
            present: {
                manifest: false,
                client: false,
                agent: false,
                programs: false,
                docs: false,
                zkMd: false,
            },
            operations: [],
            programId: null,
            trustGate: {},
            env: { required: [], optionalSet: [] },
            timestamp,
            error: "zk-primitives root not found (expected ./zk-primitives/MANIFEST.json)",
        };
    }
    const manifest = loadZkManifest(root);
    const present = {
        manifest: existsSync(path.join(root, "MANIFEST.json")),
        client: existsSync(path.join(root, "client", "package.json")),
        agent: existsSync(path.join(root, "agent", "package.json")),
        programs: existsSync(path.join(root, "programs", "clawd-zk")),
        docs: existsSync(path.join(root, "docs")),
        zkMd: existsSync(path.join(root, "zk.md")),
    };
    const requiredNames = manifest?.environment?.requiredForOnchainActions ?? ["CLAWD_ZK_RPC_URL"];
    const optionalNames = manifest?.environment?.optional ?? [];
    const required = requiredNames.map((name) => ({ name, set: envSet(name) }));
    const optionalSet = optionalNames.filter((n) => envSet(n));
    const programId = manifest?.packages?.program?.programId ??
        "CLAWDzk11111111111111111111111111111111111";
    const operations = manifest?.operations ?? [
        "publish_attestation",
        "consume_attestation",
        "commit_encrypted_state",
        "verify_proof",
        "compute_nullifier",
    ];
    const trustGate = manifest?.trustGate ?? {
        default: "observer",
        onchainBuildInstruction: "dry-run",
        signAndSendTransaction: "delegated",
    };
    return {
        ok: present.manifest && present.client && present.agent,
        root,
        manifest,
        present,
        operations,
        programId,
        trustGate,
        env: { required, optionalSet },
        timestamp,
    };
}
/**
 * Catalog summary suitable for tools / system prompts (JSON-serializable).
 */
export function getZkCatalog() {
    const health = getZkHealth();
    const m = health.manifest;
    const packages = {};
    if (m?.packages) {
        for (const [k, v] of Object.entries(m.packages)) {
            if (v?.name)
                packages[k] = v.name;
        }
    }
    const docs = m?.docs
        ? Object.values(m.docs).map((d) => String(d))
        : ["README.md", "zk.md", "docs/ARCHITECTURE.md", "docs/INTEGRATION.md"];
    return {
        name: m?.name ?? "Clawd ZK Primitives",
        status: m?.status ?? "unknown",
        description: m?.description ??
            "Nullifiers, Groth16 proof preparation, and Light Protocol compressed-state helpers.",
        root: health.root,
        programId: health.programId,
        operations: health.operations,
        packages,
        docs,
        trustGate: health.trustGate,
    };
}
/**
 * Read-only reference snippet for system prompts (constitution-aligned).
 */
export function getZkPromptContext() {
    const cat = getZkCatalog();
    return [
        "## ZK Primitives (observer)",
        `${cat.name} — ${cat.status}`,
        cat.description,
        `Program: ${cat.programId ?? "unset"}`,
        `Ops: ${cat.operations.join(", ")}`,
        "Trust: inspect/nullifier/verify = observer; build ix = dry-run; sign+send = delegated.",
        "Laws I–III still bind ZK paths: beach before harm; honest work only; never deceive.",
    ].join("\n");
}
//# sourceMappingURL=primitives.js.map