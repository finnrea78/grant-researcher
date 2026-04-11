import { extractAll, extractJsonBlock, ScanPlanEntry } from "../scan-extract";
import { FirecrawlError } from "../firecrawl";
import { formatSSEEvent } from "@/lib/sse";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("../firecrawl", () => ({
  scrapeUrl: jest.fn(),
  FirecrawlError: class FirecrawlError extends Error {
    constructor(
      public url: string,
      public statusCode: number,
      message: string
    ) {
      super(message);
      this.name = "FirecrawlError";
    }
  },
}));

jest.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: jest.fn(),
}));

import { scrapeUrl } from "../firecrawl";
import { query } from "@anthropic-ai/claude-agent-sdk";

const mockScrapeUrl = scrapeUrl as jest.MockedFunction<typeof scrapeUrl>;
const mockQuery = query as jest.MockedFunction<typeof query>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeEntry(slug: string) {
  return {
    funder_slug: slug,
    funder_name: `${slug} Foundation`,
    source_url: `https://${slug}.org/grants`,
    disciplines: ["health"],
    opportunities: [],
  };
}

async function* makeQueryIterable(entry: unknown) {
  yield {
    type: "assistant" as const,
    message: {
      content: [{ type: "text" as const, text: JSON.stringify(entry) }],
    },
  };
}

interface MockController extends ReadableStreamDefaultController<string> {
  enqueue: jest.Mock<void, [string]>;
}

function makeMockController(): MockController {
  const enqueued: string[] = [];
  return {
    enqueue: jest.fn((chunk: string) => enqueued.push(chunk)),
    enqueued,
    close: jest.fn(),
    error: jest.fn(),
    desiredSize: null,
  } as unknown as MockController;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe("extractAll", () => {
  it("both URLs succeed: returns 2 DiscoveredManifestEntry objects", async () => {
    const urls: ScanPlanEntry[] = [
      { slug: "wellcome", url: "https://wellcome.org/grants" },
      { slug: "ukri", url: "https://ukri.org/grants" },
    ];

    mockScrapeUrl.mockResolvedValue({ markdown: "# Grants page" });
    mockQuery
      .mockReturnValueOnce(makeQueryIterable(fakeEntry("wellcome")) as any)
      .mockReturnValueOnce(makeQueryIterable(fakeEntry("ukri")) as any);

    const controller = makeMockController();
    const results = await extractAll(urls, controller);

    expect(results).toHaveLength(2);
    expect(results[0].funder_slug).toBe("wellcome");
    expect(results[1].funder_slug).toBe("ukri");
  });

  it("Firecrawl failure is skipped: 1 good URL + 1 throw → returns 1 entry", async () => {
    const urls: ScanPlanEntry[] = [
      { slug: "wellcome", url: "https://wellcome.org/grants" },
      { slug: "broken", url: "https://broken.org/grants" },
    ];

    mockScrapeUrl
      .mockResolvedValueOnce({ markdown: "# Good page" })
      .mockRejectedValueOnce(new (FirecrawlError as any)("https://broken.org/grants", 500, "Server Error"));

    mockQuery.mockReturnValueOnce(makeQueryIterable(fakeEntry("wellcome")) as any);

    const controller = makeMockController();
    const results = await extractAll(urls, controller);

    expect(results).toHaveLength(1);
    expect(results[0].funder_slug).toBe("wellcome");
  });

  it("Haiku parse failure is skipped: returns 1 entry for the other URL", async () => {
    const urls: ScanPlanEntry[] = [
      { slug: "wellcome", url: "https://wellcome.org/grants" },
      { slug: "unparseable", url: "https://unparseable.org/grants" },
    ];

    mockScrapeUrl.mockResolvedValue({ markdown: "# Grants page" });
    mockQuery
      .mockReturnValueOnce(makeQueryIterable(fakeEntry("wellcome")) as any)
      .mockReturnValueOnce(
        (async function* () {
          yield {
            type: "assistant" as const,
            message: {
              content: [{ type: "text" as const, text: "This is not JSON at all!" }],
            },
          };
        })() as any
      );

    const controller = makeMockController();
    const results = await extractAll(urls, controller);

    expect(results).toHaveLength(1);
    expect(results[0].funder_slug).toBe("wellcome");
  });

  it("SSE progress events: fetching → extracting → done emitted per URL", async () => {
    const urls: ScanPlanEntry[] = [
      { slug: "wellcome", url: "https://wellcome.org/grants" },
    ];

    mockScrapeUrl.mockResolvedValue({ markdown: "# Grants page" });
    mockQuery.mockReturnValueOnce(makeQueryIterable(fakeEntry("wellcome")) as any);

    const controller = makeMockController();
    await extractAll(urls, controller);

    const enqueuedArgs = controller.enqueue.mock.calls.map((c: [string]) =>
      JSON.parse(c[0].replace(/^data: /, "").trim()) as Record<string, unknown>
    );
    const progressEvents = enqueuedArgs.filter((e: Record<string, unknown>) => e.type === "progress");

    const statuses = progressEvents.map((e: Record<string, unknown>) => e.status);
    expect(statuses).toEqual(["fetching", "extracting", "done"]);

    expect(progressEvents[0]).toMatchObject({ type: "progress", slug: "wellcome", total: 1 });
  });

  it("failed URL emits status: 'failed' progress event", async () => {
    const urls: ScanPlanEntry[] = [
      { slug: "broken", url: "https://broken.org/grants" },
    ];

    mockScrapeUrl.mockRejectedValueOnce(
      new (FirecrawlError as any)("https://broken.org/grants", 404, "Not Found")
    );

    const controller = makeMockController();
    await extractAll(urls, controller);

    const enqueuedArgs = controller.enqueue.mock.calls.map((c: [string]) =>
      JSON.parse(c[0].replace(/^data: /, "").trim()) as Record<string, unknown>
    );
    const failedEvents = enqueuedArgs.filter(
      (e: Record<string, unknown>) => e.type === "progress" && e.status === "failed"
    );

    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0]).toMatchObject({ slug: "broken", status: "failed" });
  });
});

describe("extractJsonBlock", () => {
  it("strips code fences: ```json\\n{...}\\n``` → parsed JSON", () => {
    const input = "```json\n{\"foo\":\"bar\"}\n```";
    const result = extractJsonBlock(input);
    expect(result).toEqual({ foo: "bar" });
  });

  it("strips plain code fences: ```\\n{...}\\n``` → parsed JSON", () => {
    const input = "```\n{\"hello\":42}\n```";
    const result = extractJsonBlock(input);
    expect(result).toEqual({ hello: 42 });
  });

  it("handles raw JSON without fences", () => {
    const input = '{"a":1,"b":[2,3]}';
    const result = extractJsonBlock(input);
    expect(result).toEqual({ a: 1, b: [2, 3] });
  });

  it("throws on non-JSON plaintext", () => {
    expect(() => extractJsonBlock("This is definitely not JSON")).toThrow();
  });

  it("throws on empty string", () => {
    expect(() => extractJsonBlock("")).toThrow();
  });
});
