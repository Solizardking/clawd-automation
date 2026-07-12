/**
 * Conway Automaton - Type Definitions
 *
 * All shared interfaces for the sovereign AI agent runtime.
 */
export const DEFAULT_CONFIG = {
    conwayApiUrl: "https://api.conway.tech",
    inferenceModel: "gpt-4o",
    maxTokensPerTurn: 4096,
    heartbeatConfigPath: "~/.automaton/heartbeat.yml",
    dbPath: "~/.automaton/state.db",
    logLevel: "info",
    version: "0.1.0",
    skillsDir: "~/.automaton/skills",
    maxChildren: 3,
    socialRelayUrl: "https://social.conway.tech",
};
export const SURVIVAL_THRESHOLDS = {
    normal: 50, // > $0.50 in cents
    low_compute: 10, // $0.10 - $0.50
    critical: 10, // < $0.10
    dead: 0,
};
export const MAX_CHILDREN = 3;
//# sourceMappingURL=types.js.map