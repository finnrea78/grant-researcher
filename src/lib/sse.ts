import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export type SSEEvent =
  | { type: "tool"; name: string }
  | { type: "text"; text: string }
  | { type: "result"; turns: number; cost: number; duration: number }
  | { type: "error"; message: string }
  | { type: "progress"; current: number; total: number; slug: string; status: "fetching" | "extracting" | "done" | "failed" }
  | { type: "match"; match: Record<string, unknown> };

export function formatSSEEvent(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Enqueue data to an SSE controller, swallowing errors if the client
 * has disconnected. This ensures server-side work (DB persistence,
 * pipeline state updates) always completes even when the SSE stream dies.
 */
export function safeEnqueue(
  controller: ReadableStreamDefaultController<string>,
  data: string
): void {
  try {
    controller.enqueue(data);
  } catch {
    // Client disconnected — controller is closed/errored. Swallow silently.
  }
}

/**
 * Pipe a Claude Agent SDK query stream to an SSE controller.
 *
 * Accepts a factory function so retries can recreate the stream.
 * Does NOT close the controller — callers own the close so they can do
 * post-stream work (persist results, Supabase sync, etc.) before closing.
 *
 * On rate-limit errors (429 / "rate" in message), retries up to `maxRetries`
 * times, sending a user-visible SSE text event during each wait.
 */
export async function pipeQueryToSSE(
  queryFactory: () => AsyncIterable<SDKMessage>,
  controller: ReadableStreamDefaultController<string>,
  options?: { maxRetries?: number }
): Promise<void> {
  const maxRetries = process.env.DISABLE_RETRY === "true" ? 0 : (options?.maxRetries ?? 2);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      for await (const message of queryFactory()) {
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
      return; // success — exit retry loop
    } catch (err) {
      const isLast = attempt >= maxRetries;
      const isRateLimit = isRateLimitError(err);

      if (isLast || !isRateLimit) {
        throw err;
      }

      const delayMs = getRetryAfterMs(err) ?? computeBackoff(attempt);
      const delaySec = Math.round(delayMs / 1000);
      controller.enqueue(
        formatSSEEvent({ type: "text", text: `Rate limited — retrying in ${delaySec}s…` })
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: number }).status;
  if (status === 429) return true;
  const message = (err as { message?: string }).message ?? "";
  return /rate|overloaded/i.test(message);
}

function getRetryAfterMs(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const headers = (err as { headers?: Headers }).headers;
  const value = headers?.get?.("retry-after");
  if (!value) return null;
  const numeric = parseFloat(value);
  return isNaN(numeric) ? null : numeric * 1000;
}

function computeBackoff(attempt: number): number {
  const base = 2000;
  const max = 30000;
  const exp = Math.min(base * Math.pow(2, attempt), max);
  return Math.floor(exp + exp * 0.25 * Math.random());
}

/**
 * Start a heartbeat interval that sends SSE comment lines to keep Railway's
 * proxy (and any other idle-connection-killing intermediary) from closing the
 * connection during long agent operations. Comment lines (`: …`) are ignored
 * by SSE clients and impose zero overhead on the consumer.
 *
 * Returns the interval ID — callers MUST clearInterval in their finally block.
 */
export function startHeartbeat(
  controller: ReadableStreamDefaultController<string>,
  intervalMs = 20000
): ReturnType<typeof setInterval> {
  return setInterval(() => {
    try {
      controller.enqueue(": heartbeat\n\n");
    } catch {
      // Controller already closed — interval will be cleared by the caller
    }
  }, intervalMs);
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
