import { scrapeUrl, FirecrawlError } from "../firecrawl";

// Disable retries so tests run synchronously unless we're testing retry behaviour
process.env.DISABLE_RETRY = "true";

describe("scrapeUrl", () => {
  const ORIGINAL_KEY = process.env.FIRECRAWL_API_KEY;

  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = "test-key";
    jest.restoreAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) {
      delete process.env.FIRECRAWL_API_KEY;
    } else {
      process.env.FIRECRAWL_API_KEY = ORIGINAL_KEY;
    }
    // Always restore retry disable so tests remain isolated
    process.env.DISABLE_RETRY = "true";
  });

  it("returns { markdown } on a successful scrape", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: true, data: { markdown: "# Hello" } }),
        { status: 200 }
      )
    );

    const result = await scrapeUrl("https://example.com");
    expect(result).toEqual({ markdown: "# Hello" });
  });

  it("throws FirecrawlError with url and statusCode on non-200 response", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("Payment Required", { status: 402 })
    );

    await expect(scrapeUrl("https://example.com/paid")).rejects.toMatchObject({
      name: "FirecrawlError",
      url: "https://example.com/paid",
      statusCode: 402,
    });
  });

  it("throws early with clear message when FIRECRAWL_API_KEY is not set", async () => {
    delete process.env.FIRECRAWL_API_KEY;
    const fetchSpy = jest.spyOn(global, "fetch");

    await expect(scrapeUrl("https://example.com")).rejects.toThrow(
      "FIRECRAWL_API_KEY is not set"
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("retries on network error and succeeds on second attempt", async () => {
    // Re-enable retry and use fake timers so delays don't stall the test
    delete process.env.DISABLE_RETRY;
    jest.useFakeTimers();

    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, data: { markdown: "# Retried" } }),
          { status: 200 }
        )
      );

    const promise = scrapeUrl("https://example.com/retry");
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ markdown: "# Retried" });

    jest.useRealTimers();
  });

  it("throws FirecrawlError when response is HTTP 200 but success: false", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, error: "Rate limit exceeded" }),
        { status: 200 }
      )
    );

    await expect(scrapeUrl("https://example.com/limited")).rejects.toMatchObject({
      name: "FirecrawlError",
      url: "https://example.com/limited",
      statusCode: 200,
      message: expect.stringContaining("Rate limit exceeded"),
    });
  });
});
