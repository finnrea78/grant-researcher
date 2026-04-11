import { withRetry } from "@/lib/retry";

export class FirecrawlError extends Error {
  constructor(
    public url: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "FirecrawlError";
  }
}

function isRetryable(error: unknown): boolean {
  // Retry on network-level errors (fetch throws, no statusCode)
  if (error instanceof Error && !(error instanceof FirecrawlError)) {
    return true;
  }
  // Retry on 429 and 5xx HTTP errors
  if (error instanceof FirecrawlError) {
    const s = error.statusCode;
    return s === 429 || s === 500 || s === 502 || s === 503 || s === 529;
  }
  return false;
}

export async function scrapeUrl(url: string): Promise<{ markdown: string }> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    throw new Error("FIRECRAWL_API_KEY is not set");
  }

  return withRetry(
    async () => {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, formats: ["markdown"], timeout: 30000 }),
      });

      if (!response.ok) {
        throw new FirecrawlError(url, response.status, await response.text());
      }

      const data = await response.json();
      return { markdown: data.data.markdown as string };
    },
    { maxRetries: 2, isRetryable, baseDelayMs: 100 }
  );
}
