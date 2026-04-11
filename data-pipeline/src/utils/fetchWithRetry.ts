// HTTP-specific retry wrapper for data-pipeline scrapers.
// Intentionally separate from src/lib/retry.ts — no cross-workspace imports.
// See also src/lib/retry.ts for the generic app version.

export interface FetchRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

function getRetryAfterMs(res: Response): number | null {
  const value = res.headers.get("retry-after");
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

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 529;
}

/**
 * fetch() wrapper with exponential backoff retry on 429/5xx and network errors.
 * Returns the last failed Response for non-retryable 4xx — let callers decide skip/throw.
 * Keeps existing sleep() floors in callers intact; this only adds retry on top.
 */
export async function fetchWithRetry(
  url: string | URL,
  init?: RequestInit,
  options?: FetchRetryOptions
): Promise<Response> {
  if (process.env.DISABLE_RETRY === "true") return fetch(url, init);

  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const maxDelayMs = options?.maxDelayMs ?? 30000;

  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      // Network error — retry with backoff
      if (attempt > maxRetries) throw err;
      const delay = computeDelay(attempt, baseDelayMs, maxDelayMs);
      console.warn(`[fetchWithRetry] ${url} network error, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    if (!isRetryableStatus(response.status)) {
      return response; // success or non-retryable error — let caller handle
    }

    lastResponse = response;
    if (attempt > maxRetries) break;

    const delay = getRetryAfterMs(response) ?? computeDelay(attempt, baseDelayMs, maxDelayMs);
    console.warn(`[fetchWithRetry] ${url} returned ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return lastResponse!;
}
