// Minimal retry utility for the data-pipeline workspace.
// Intentional copy of src/lib/retry.ts — no cross-workspace imports allowed.
// See also src/lib/retry.ts for the Next.js app version.

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

function defaultIsRetryable(error: unknown): boolean {
  if (error && typeof error === "object") {
    const status = (error as { status?: number }).status;
    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 529) return true;
    const message = (error as { message?: string }).message ?? "";
    if (/rate|overloaded/i.test(message)) return true;
  }
  return false;
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
  if (process.env.DISABLE_RETRY === "true") return fn();

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
      if (isLast || !isRetryable(err)) throw err;
      const delay = computeDelay(attempt, baseDelayMs, maxDelayMs);
      onRetry?.(attempt, delay, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
