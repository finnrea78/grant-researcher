/**
 * Logs progress from query() messages so the user can see activity.
 * Prints tool names and assistant text as they arrive, then the final result.
 */
export async function streamToConsole(messages) {
    for await (const message of messages) {
        if (message.type === "assistant") {
            // Content lives in message.message.content (BetaMessage)
            for (const block of message.message.content) {
                if (block.type === "tool_use") {
                    console.log(`  [${block.name}]`);
                }
                else if (block.type === "text" && block.text.trim()) {
                    console.log(block.text.trim());
                }
            }
        }
        else if (message.type === "result") {
            if (message.is_error) {
                const errors = "errors" in message ? message.errors.join("\n") : "Unknown error";
                console.error("Error:", errors);
            }
            else if ("result" in message) {
                console.log("\n" + message.result);
            }
            console.log(`\nDone in ${(message.duration_ms / 1000).toFixed(1)}s | ` +
                `${message.num_turns} turns | ` +
                `$${message.total_cost_usd.toFixed(4)}`);
        }
    }
}
//# sourceMappingURL=stream.js.map