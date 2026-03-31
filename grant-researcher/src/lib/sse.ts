import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export type SSEEvent =
  | { type: "tool"; name: string }
  | { type: "text"; text: string }
  | { type: "result"; turns: number; cost: number; duration: number }
  | { type: "error"; message: string };

export function formatSSEEvent(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function pipeQueryToSSE(
  messages: AsyncIterable<SDKMessage>,
  controller: ReadableStreamDefaultController<string>
): Promise<void> {
  try {
    for await (const message of messages) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "tool_use") {
            controller.enqueue(formatSSEEvent({ type: "tool", name: block.name }));
          } else if (block.type === "text" && block.text.trim()) {
            controller.enqueue(formatSSEEvent({ type: "text", text: block.text.trim() }));
          }
        }
      } else if (message.type === "result") {
        if (message.is_error) {
          const msg = "errors" in message ? message.errors.join("; ") : "Unknown error";
          controller.enqueue(formatSSEEvent({ type: "error", message: msg }));
        } else if ("result" in message) {
          controller.enqueue(
            formatSSEEvent({
              type: "result",
              turns: message.num_turns,
              cost: message.total_cost_usd,
              duration: message.duration_ms,
            })
          );
        }
      }
    }
  } finally {
    controller.close();
  }
}

export function sseResponse(stream: ReadableStream<string>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
