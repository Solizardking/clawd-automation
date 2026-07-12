/**
 * Clawd Credits Management
 *
 * Monitors the automaton's compute credit balance and triggers
 * survival mode transitions.
 */
import type { ClawdClient, FinancialState, SurvivalTier, AutomatonDatabase } from "../types.js";
/**
 * Check the current financial state of the automaton.
 */
export declare function checkFinancialState(clawd: ClawdClient, usdcBalance: number): Promise<FinancialState>;
/**
 * Determine the survival tier based on current credits.
 */
export declare function getSurvivalTier(creditsCents: number): SurvivalTier;
/**
 * Format a credit amount for display.
 */
export declare function formatCredits(cents: number): string;
/**
 * Log a credit check to the database.
 */
export declare function logCreditCheck(db: AutomatonDatabase, state: FinancialState): void;
//# sourceMappingURL=credits.d.ts.map