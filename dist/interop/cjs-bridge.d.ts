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
/**
 * Locate the directory that contains the CJS packages (services/, agents/, …).
 * Works for both `src/interop/` (tsx/dev) and `dist/interop/` (compiled).
 */
export declare function resolveSrcRoot(fromDir?: string): string;
export type CjsCapabilityName = "constitution" | "personas" | "skillhub" | "knowledge" | "x402_knowledge" | "config" | "cli_commands" | "agents" | "base_agent" | "providers" | "unified_ai";
export interface CjsLoadResult {
    name: CjsCapabilityName;
    ok: boolean;
    exports?: unknown;
    error?: string;
    path?: string;
}
export interface CjsHealthReport {
    srcRoot: string;
    loaded: CjsLoadResult[];
    available: CjsCapabilityName[];
    unavailable: Array<{
        name: CjsCapabilityName;
        error: string;
    }>;
    timestamp: string;
}
/**
 * Absolute path to the CJS source root (always the tree with services/*.js).
 */
export declare function getCjsSrcRoot(): string;
/**
 * Load a single CJS capability by name. Results are cached.
 */
export declare function loadCjsCapability(name: CjsCapabilityName): CjsLoadResult;
/**
 * Probe all registered CJS capabilities and return a health report.
 */
export declare function getCjsHealth(): CjsHealthReport;
/**
 * Describe export shape for class/function/module objects (used by tools/tests).
 */
export declare function describeCjsExport(exports: unknown): {
    kind: string;
    keys: string[];
    methods: string[];
    name?: string;
};
/**
 * Invoke a known capability method and return a serializable shape.
 * Used by tools and tests — never stubs the underlying module.
 */
export declare function invokeCjsCapability(name: CjsCapabilityName, method: string, args?: unknown[]): {
    ok: boolean;
    result?: unknown;
    error?: string;
};
/**
 * Clear the load cache (tests).
 */
export declare function clearCjsBridgeCache(): void;
/**
 * List capability names registered on the bridge.
 */
export declare function listCjsCapabilities(): CjsCapabilityName[];
/** Test helper: capability path map for the active SRC_ROOT. */
export declare function getCapabilityPaths(): Record<CjsCapabilityName, string>;
//# sourceMappingURL=cjs-bridge.d.ts.map