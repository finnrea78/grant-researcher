import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
/**
 * Logs progress from query() messages so the user can see activity.
 * Prints tool names and assistant text as they arrive, then the final result.
 */
export declare function streamToConsole(messages: AsyncIterable<SDKMessage>): Promise<void>;
//# sourceMappingURL=stream.d.ts.map