/**
 * Automaton Database
 *
 * SQLite-backed persistent state for the automaton.
 * Uses better-sqlite3 for synchronous, single-process access.
 */
import type { AutomatonDatabase } from "../types.js";
export declare function createDatabase(dbPath: string): AutomatonDatabase;
//# sourceMappingURL=database.d.ts.map