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
  if (error instanceof FirecrawlError) {
    return error.statusCode === 429 || error.statusCode >= 500;
  }
  // Only retry genuine network errors (fetch connection failures)
  return error instanceof TypeError;
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

      interface FirecrawlResponse {
        success: boolean;
        data?: { markdown: string };
        error?: string;
      }
      const data = (await response.json()) as FirecrawlResponse;
      if (!data.success || !data.data?.markdown) {
        throw new FirecrawlError(url, response.status, data.error ?? "Missing markdown in response");
      }
      return { markdown: data.data.markdown };
    },
    { maxRetries: 2, isRetryable, baseDelayMs: 100 }
  );
}
