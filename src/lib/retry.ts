// Generic retry utility for all external API calls in the Next.js app.
// See also data-pipeline/src/utils/retry.ts for the pipeline copy (intentional duplication — no cross-workspace imports).

export interface RetryOptions {
  /** Maximum number of retry attempts after the initial call. Default: 3 */
  maxRetries?: number;
  /** Base delay in ms before first retry. Default: 1000 */
  baseDelayMs?: number;
  /** Maximum delay cap in ms. Default: 30000 */
  maxDelayMs?: number;
  /** Return true if the error should trigger a retry. Default: retries on 429/5xx and rate-limit messages */
  isRetryable?: (error: unknown) => boolean;
  /** Called before each retry sleep. Useful for SSE progress events. */
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

function defaultIsRetryable(error: unknown): boolean {
  if (error && typeof error === "object") {
    const status = (error as { status?: number }).status;
    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 529) {
      return true;
    }
    const message = (error as { message?: string }).message ?? "";
    if (/rate|overloaded/i.test(message)) return true;
  }
  return false;
}

function getRetryAfterMs(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const headers = (error as { headers?: Headers | Record<string, string> }).headers;
  if (!headers) return null;
  const value =
    typeof (headers as Headers).get === "function"
      ? (headers as Headers).get("retry-after")
      : (headers as Record<string, string>)["retry-after"];
  if (!value) return null;
  const numeric = parseFloat(value);
  if (!isNaN(numeric)) return numeric * 1000;
  const date = Date.parse(value);
  if (!isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

function computeDelay(attempt: number, base: number, max: number): number {
  const exp = Math.min(base * Math.pow(2, attempt - 1), max);
  const jitter = exp * 0.25 * Math.random();
  return Math.floor(exp + jitter);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  if (process.env.DISABLE_RETRY === "true") {
    return fn();
  }

  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const maxDelayMs = options?.maxDelayMs ?? 30000;
  const isRetryable = options?.isRetryable ?? defaultIsRetryable;
  const onRetry = options?.onRetry;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLast = attempt > maxRetries;
      if (isLast || !isRetryable(err)) {
        throw err;
      }

      const retryAfter = getRetryAfterMs(err);
      const delay = retryAfter ?? computeDelay(attempt, baseDelayMs, maxDelayMs);

      onRetry?.(attempt, delay, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
