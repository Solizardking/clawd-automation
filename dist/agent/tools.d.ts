/**
 * Automaton Tool System
 *
 * Defines all tools the automaton can call, with self-preservation guards.
 * Tools are organized by category and exposed to the inference model.
 */
import type { AutomatonTool, ToolContext, InferenceToolDefinition, ToolCallResult } from "../types.js";
export declare function createBuiltinTools(sandboxId: string): AutomatonTool[];
/**
 * Convert AutomatonTool list to OpenAI-compatible tool definitions.
 */
export declare function toolsToInferenceFormat(tools: AutomatonTool[]): InferenceToolDefinition[];
/**
 * Execute a tool call and return the result.
 */
export declare function executeTool(toolName: string, args: Record<string, unknown>, tools: AutomatonTool[], context: ToolContext): Promise<ToolCallResult>;
//# sourceMappingURL=tools.d.ts.map