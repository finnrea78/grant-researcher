import { extractAll, extractJsonBlock, ScanPlanEntry } from "../scan-extract";

jest.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: jest.fn(),
}));

import { query } from "@anthropic-ai/claude-agent-sdk";

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

async function* makeQueryIterable(entry: unknown, turns = 1, cost = 0.001) {
  yield {
    type: "assistant" as const,
    message: {
      content: [{ type: "text" as const, text: JSON.stringify(entry) }],
    },
  };
  yield {
    type: "result" as const,
    is_error: false,
    result: "success",
    num_turns: turns,
    total_cost_usd: cost,
    duration_ms: 500,
  };
}

async function* makeFailingIterable() {
  yield {
    type: "assistant" as const,
    message: {
      content: [{ type: "text" as const, text: "This is not JSON at all!" }],
    },
  };
  yield {
    type: "result" as const,
    is_error: false,
    result: "success",
    num_turns: 1,
    total_cost_usd: 0,
    duration_ms: 100,
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
  it("both URLs succeed: returns 2 results and 0 failed", async () => {
    const urls: ScanPlanEntry[] = [
      { slug: "wellcome", url: "https://wellcome.org/grants" },
      { slug: "ukri", url: "https://ukri.org/grants" },
    ];

    mockQuery
      .mockReturnValueOnce(makeQueryIterable(fakeEntry("wellcome")) as any)
      .mockReturnValueOnce(makeQueryIterable(fakeEntry("ukri")) as any);

    const controller = makeMockController();
    const { results, failed } = await extractAll(urls, controller);

    expect(results.map(r => r.funder_slug)).toEqual(expect.arrayContaining(["wellcome", "ukri"]));
    expect(results).toHaveLength(2);
    expect(failed).toHaveLength(0);
  });

  it("query throws: slug appears in failed, not in results", async () => {
    const urls: ScanPlanEntry[] = [
      { slug: "wellcome", url: "https://wellcome.org/grants" },
      { slug: "broken", url: "https://broken.org/grants" },
    ];

    mockQuery
      .mockReturnValueOnce(makeQueryIterable(fakeEntry("wellcome")) as any)
      .mockImplementationOnce(() => { throw new Error("WebFetch failed"); });

    const controller = makeMockController();
    const { results, failed } = await extractAll(urls, controller);

    expect(results).toHaveLength(1);
    expect(results[0].funder_slug).toBe("wellcome");
    expect(failed).toHaveLength(1);
    expect(failed[0]).toEqual({ slug: "broken", url: "https://broken.org/grants" });
  });

  it("unparseable response: slug appears in failed, not in results", async () => {
    const urls: ScanPlanEntry[] = [
      { slug: "wellcome", url: "https://wellcome.org/grants" },
      { slug: "unparseable", url: "https://unparseable.org/grants" },
    ];

    mockQuery
      .mockReturnValueOnce(makeQueryIterable(fakeEntry("wellcome")) as any)
      .mockReturnValueOnce(makeFailingIterable() as any);

    const controller = makeMockController();
    const { results, failed } = await extractAll(urls, controller);

    expect(results).toHaveLength(1);
    expect(results[0].funder_slug).toBe("wellcome");
    expect(failed).toHaveLength(1);
    expect(failed[0].slug).toBe("unparseable");
  });

  it("emits a result event after all extractions with aggregated cost and turns", async () => {
    const urls: ScanPlanEntry[] = [
      { slug: "wellcome", url: "https://wellcome.org/grants" },
      { slug: "ukri", url: "https://ukri.org/grants" },
    ];

    mockQuery
      .mockReturnValueOnce(makeQueryIterable(fakeEntry("wellcome"), 3, 0.002) as any)
      .mockReturnValueOnce(makeQueryIterable(fakeEntry("ukri"), 2, 0.001) as any);

    const controller = makeMockController();
    await extractAll(urls, controller);

    const events = controller.enqueue.mock.calls.map((c: [string]) =>
      JSON.parse(c[0].replace(/^data: /, "").trim()) as Record<string, unknown>
    );
    const resultEvents = events.filter(e => e.type === "result");

    expect(resultEvents).toHaveLength(1);
    expect(resultEvents[0].turns).toBe(5);
    expect((resultEvents[0].cost as number)).toBeCloseTo(0.003);
  });

  it("SSE progress events: extracting → done emitted per URL", async () => {
    const urls: ScanPlanEntry[] = [
      { slug: "wellcome", url: "https://wellcome.org/grants" },
    ];

    mockQuery.mockReturnValueOnce(makeQueryIterable(fakeEntry("wellcome")) as any);

    const controller = makeMockController();
    await extractAll(urls, controller);

    const events = controller.enqueue.mock.calls.map((c: [string]) =>
      JSON.parse(c[0].replace(/^data: /, "").trim()) as Record<string, unknown>
    );
    const progressEvents = events.filter(e => e.type === "progress");

    expect(progressEvents.map(e => e.status)).toEqual(["extracting", "done"]);
    expect(progressEvents[0]).toMatchObject({ type: "progress", slug: "wellcome", total: 1 });
  });

  it("failed URL emits 'failed' progress event and appears in failed array", async () => {
    const urls: ScanPlanEntry[] = [
      { slug: "broken", url: "https://broken.org/grants" },
    ];

    mockQuery.mockReturnValueOnce(makeFailingIterable() as any);

    const controller = makeMockController();
    const { results, failed } = await extractAll(urls, controller);

    const events = controller.enqueue.mock.calls.map((c: [string]) =>
      JSON.parse(c[0].replace(/^data: /, "").trim()) as Record<string, unknown>
    );
    const failedEvents = events.filter(e => e.type === "progress" && e.status === "failed");

    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0]).toMatchObject({ slug: "broken", status: "failed" });
    expect(results).toHaveLength(0);
    expect(failed[0].slug).toBe("broken");
  });
});

describe("extractJsonBlock", () => {
  it("strips ```json fences", () => {
    expect(extractJsonBlock("```json\n{\"foo\":\"bar\"}\n```")).toEqual({ foo: "bar" });
  });

  it("strips plain ``` fences", () => {
    expect(extractJsonBlock("```\n{\"hello\":42}\n```")).toEqual({ hello: 42 });
  });

  it("handles raw JSON without fences", () => {
    expect(extractJsonBlock('{"a":1,"b":[2,3]}')).toEqual({ a: 1, b: [2, 3] });
  });

  it("extracts JSON from multi-turn reasoning text (Haiku thinking before final output)", () => {
    const multiTurnText = `I'll fetch the page now.\n\nAfter checking the scheme pages, here is the extracted data:\n\n{"funder_slug":"nhmrc","funder_name":"NHMRC","source_url":"https://nhmrc.gov.au","disciplines":[],"opportunities":[]}`;
    expect(extractJsonBlock(multiTurnText)).toMatchObject({ funder_slug: "nhmrc" });
  });

  it("throws on non-JSON plaintext", () => {
    expect(() => extractJsonBlock("This is definitely not JSON")).toThrow();
  });

  it("throws on empty string", () => {
    expect(() => extractJsonBlock("")).toThrow();
  });
});
