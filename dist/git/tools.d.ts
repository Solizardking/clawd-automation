/**
 * Git Tools
 *
 * Built-in git operations for the automaton.
 * Used for both state versioning and code development.
 */
import type { ClawdClient, GitStatus, GitLogEntry } from "../types.js";
/**
 * Get git status for a repository.
 */
export declare function gitStatus(clawd: ClawdClient, repoPath: string): Promise<GitStatus>;
/**
 * Get git diff output.
 */
export declare function gitDiff(clawd: ClawdClient, repoPath: string, staged?: boolean): Promise<string>;
/**
 * Create a git commit.
 */
export declare function gitCommit(clawd: ClawdClient, repoPath: string, message: string, addAll?: boolean): Promise<string>;
/**
 * Get git log.
 */
export declare function gitLog(clawd: ClawdClient, repoPath: string, limit?: number): Promise<GitLogEntry[]>;
/**
 * Push to remote.
 */
export declare function gitPush(clawd: ClawdClient, repoPath: string, remote?: string, branch?: string): Promise<string>;
/**
 * Manage branches.
 */
export declare function gitBranch(clawd: ClawdClient, repoPath: string, action: "list" | "create" | "checkout" | "delete", branchName?: string): Promise<string>;
/**
 * Clone a repository.
 */
export declare function gitClone(clawd: ClawdClient, url: string, targetPath: string, depth?: number): Promise<string>;
/**
 * Initialize a git repository.
 */
export declare function gitInit(clawd: ClawdClient, repoPath: string): Promise<string>;
//# sourceMappingURL=tools.d.ts.map