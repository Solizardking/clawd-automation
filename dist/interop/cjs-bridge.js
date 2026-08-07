/**
 * CJS Interop Bridge
 *
 * Loads the legacy CommonJS capability surface (services, providers, agents,
 * knowledge, cli, config/) into the ESM primary runtime graph via createRequire.
 *
 * Heavy modules that pull optional native/network deps are loaded lazily and
 * failures are reported as unavailable rather than crashing composition.
 *
 * Path notes:
 * - CJS sources live under repo `src/` (not compiled into dist/).
 * - When this module is compiled to dist/interop/, SRC_ROOT still resolves to
 *   the source tree so CAPABILITY_PATHS remain valid under `node dist/index.js`.
 * - Nested CJS must require `../config/index.js` (not bare `../config`) so tsx
 *   does not redirect to the ESM `src/config.ts` Automaton config.
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Locate the directory that contains the CJS packages (services/, agents/, …).
 * Works for both `src/interop/` (tsx/dev) and `dist/interop/` (compiled).
 */
export function resolveSrcRoot(fromDir = __dirname) {
    const candidates = [
        // Running from src/interop or dist/interop → sibling ../services
        path.resolve(fromDir, ".."),
        // Running from dist/interop → ../../src
        path.resolve(fromDir, "..", "..", "src"),
        // Running from unexpected nest → walk up looking for services/constitution.js
        path.resolve(fromDir, "..", ".."),
        path.resolve(fromDir, "..", "..", "..", "src"),
    ];
    for (const candidate of candidates) {
        if (existsSync(path.join(candidate, "services", "constitution.js"))) {
            return candidate;
        }
    }
    // Last resort: assume sibling of interop
    return path.resolve(fromDir, "..");
}
const SRC_ROOT = resolveSrcRoot();
// createRequire anchored inside the CJS zone so nested .js load as CommonJS.
const require = createRequire(path.join(SRC_ROOT, "services", "package.json"));
/**
 * Primary graph registry: every non-empty CJS package has at least one entry.
 */
function buildCapabilityPaths(srcRoot) {
    return {
        constitution: path.join(srcRoot, "services", "constitution.js"),
        personas: path.join(srcRoot, "services", "personas.js"),
        lobster_council: path.join(srcRoot, "services", "lobster-council.js"),
        skillhub: path.join(srcRoot, "services", "skillhub.js"),
        knowledge: path.join(srcRoot, "knowledge", "clawdbrowser.js"),
        x402_knowledge: path.join(srcRoot, "knowledge", "x402-protocol.js"),
        config: path.join(srcRoot, "config", "index.js"),
        cli_commands: path.join(srcRoot, "cli", "commands", "index.js"),
        agents: path.join(srcRoot, "agents", "agent-council.js"),
        base_agent: path.join(srcRoot, "agents", "base-agent.js"),
        providers: path.join(srcRoot, "providers", "openrouter.js"),
        unified_ai: path.join(srcRoot, "providers", "unified-ai.js"),
    };
}
const CAPABILITY_PATHS = buildCapabilityPaths(SRC_ROOT);
const cache = new Map();
/**
 * Absolute path to the CJS source root (always the tree with services/*.js).
 */
export function getCjsSrcRoot() {
    return SRC_ROOT;
}
/**
 * Load a single CJS capability by name. Results are cached.
 */
export function loadCjsCapability(name) {
    const cached = cache.get(name);
    if (cached)
        return cached;
    const modulePath = CAPABILITY_PATHS[name];
    if (!modulePath) {
        const result = {
            name,
            ok: false,
            error: `Unknown capability: ${name}`,
        };
        cache.set(name, result);
        return result;
    }
    if (!existsSync(modulePath)) {
        const result = {
            name,
            ok: false,
            error: `Module file missing: ${modulePath}`,
            path: modulePath,
        };
        cache.set(name, result);
        return result;
    }
    try {
        const exports = require(modulePath);
        const result = {
            name,
            ok: true,
            exports,
            path: modulePath,
        };
        cache.set(name, result);
        return result;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const result = {
            name,
            ok: false,
            error: message,
            path: modulePath,
        };
        cache.set(name, result);
        return result;
    }
}
/**
 * Probe all registered CJS capabilities and return a health report.
 */
export function getCjsHealth() {
    const names = Object.keys(CAPABILITY_PATHS);
    const loaded = names.map((n) => loadCjsCapability(n));
    const available = loaded.filter((r) => r.ok).map((r) => r.name);
    const unavailable = loaded
        .filter((r) => !r.ok)
        .map((r) => ({ name: r.name, error: r.error || "unknown" }));
    return {
        srcRoot: SRC_ROOT,
        loaded,
        available,
        unavailable,
        timestamp: new Date().toISOString(),
    };
}
/**
 * Resolve a method on an export, including class-instance prototype methods.
 */
function resolveCallable(mod, method) {
    if (mod == null)
        return null;
    const obj = mod;
    if (typeof obj[method] === "function") {
        return obj[method].bind(mod);
    }
    const proto = Object.getPrototypeOf(mod);
    if (proto && typeof proto[method] === "function") {
        return proto[method].bind(mod);
    }
    if (typeof mod === "function" && typeof mod[method] === "function") {
        return mod[method].bind(mod);
    }
    return null;
}
/**
 * Describe export shape for class/function/module objects (used by tools/tests).
 */
export function describeCjsExport(exports) {
    if (exports == null) {
        return { kind: "null", keys: [], methods: [] };
    }
    if (typeof exports === "function") {
        const keys = Object.keys(exports);
        const methods = Object.getOwnPropertyNames(exports.prototype || {}).filter((k) => k !== "constructor" && typeof exports.prototype[k] === "function");
        return {
            kind: "function",
            name: exports.name || "anonymous",
            keys,
            methods,
        };
    }
    if (typeof exports === "object") {
        const keys = Object.keys(exports);
        const proto = Object.getPrototypeOf(exports);
        const methods = proto
            ? Object.getOwnPropertyNames(proto).filter((k) => k !== "constructor" &&
                typeof proto[k] === "function")
            : [];
        return { kind: "object", keys, methods };
    }
    return { kind: typeof exports, keys: [], methods: [] };
}
/**
 * Invoke a known capability method and return a serializable shape.
 * Used by tools and tests — never stubs the underlying module.
 */
export function invokeCjsCapability(name, method, args = []) {
    const loaded = loadCjsCapability(name);
    if (!loaded.ok || loaded.exports === undefined) {
        return { ok: false, error: loaded.error || `Capability ${name} unavailable` };
    }
    const mod = loaded.exports;
    if (method === "__describe") {
        return { ok: true, result: describeCjsExport(mod) };
    }
    const fn = resolveCallable(mod, method);
    if (fn) {
        try {
            const result = fn(...args);
            return { ok: true, result };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { ok: false, error: message };
        }
    }
    if (mod != null && typeof mod === "object" && method in mod) {
        return { ok: true, result: mod[method] };
    }
    if (typeof mod === "function" && method in mod) {
        return { ok: true, result: mod[method] };
    }
    if (typeof mod === "function" && method === "construct") {
        try {
            const instance = new mod(...args);
            return {
                ok: true,
                result: {
                    constructed: true,
                    className: mod.name,
                    snapshot: describeCjsExport(instance),
                    ...(instance && typeof instance === "object"
                        ? {
                            name: instance.name,
                            type: instance.type,
                            capabilities: instance.capabilities,
                            state: instance.state,
                        }
                        : {}),
                },
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { ok: false, error: message };
        }
    }
    return {
        ok: false,
        error: `Method or field '${method}' not found on ${name}`,
    };
}
/**
 * Clear the load cache (tests).
 */
export function clearCjsBridgeCache() {
    cache.clear();
    // Drop require cache for CJS capability paths so reloads re-resolve config
    for (const p of Object.values(CAPABILITY_PATHS)) {
        try {
            const resolved = require.resolve(p);
            delete require.cache[resolved];
        }
        catch {
            /* not cached */
        }
    }
    // Also clear CJS config so providers re-bind correctly after cache clear
    try {
        const cfg = require.resolve(path.join(SRC_ROOT, "config", "index.js"));
        delete require.cache[cfg];
    }
    catch {
        /* ignore */
    }
}
/**
 * List capability names registered on the bridge.
 */
export function listCjsCapabilities() {
    return Object.keys(CAPABILITY_PATHS);
}
/** Test helper: capability path map for the active SRC_ROOT. */
export function getCapabilityPaths() {
    return { ...CAPABILITY_PATHS };
}
//# sourceMappingURL=cjs-bridge.js.map