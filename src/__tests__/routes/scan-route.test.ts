/**
 * Tests for scan POST/PATCH route (DB-first, no filesystem).
 * POST: reads URLs from DB via getScanUrlList, reads researcher profile from DB,
 *       marks scan complete via updatePipelineState
 * PATCH: marks scan complete via updatePipelineState
 */

jest.mock("@/lib/auth", () => ({
  requireUser: jest.fn().mockResolvedValue({ user: { id: "user-123" }, supabase: {} }),
}));

jest.mock("@/lib/researcher-store", () => ({
  getResearcherFull: jest.fn(),
  updatePipelineState: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/concurrency", () => ({
  agentQueue: { acquire: jest.fn().mockResolvedValue(undefined), release: jest.fn() },
}));

jest.mock("@/lib/scan-db-context", () => ({
  buildScanDbContext: jest.fn().mockResolvedValue(""),
  getScanUrlList: jest.fn().mockResolvedValue([
    { slug: "ahrc", url: "https://ahrc.ukri.org" },
  ]),
}));

jest.mock("@/lib/scan-persistence", () => ({
  persistDiscoveredResults: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/scan-extract", () => ({
  extractAll: jest.fn().mockResolvedValue({ results: [], failed: [] }),
  extractJsonBlock: jest.fn().mockReturnValue({ discovered: [] }),
}));

jest.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield {
        type: "assistant",
        message: { content: [{ type: "text", text: '{"discovered": []}' }] },
      };
      yield { type: "result", is_error: false, total_cost_usd: 0.005, num_turns: 3, duration_ms: 1000 };
    },
  }),
}));

import { POST, PATCH } from "@/app/api/session/[name]/scan/route";
import { getResearcherFull, updatePipelineState } from "@/lib/researcher-store";
import { persistDiscoveredResults } from "@/lib/scan-persistence";
import { getScanUrlList } from "@/lib/scan-db-context";

const mockGetResearcherFull = getResearcherFull as jest.Mock;
const mockUpdatePipelineState = updatePipelineState as jest.Mock;
const mockGetScanUrlList = getScanUrlList as jest.Mock;
const mockPersistDiscoveredResults = persistDiscoveredResults as jest.Mock;

const RESEARCHER = {
  id: "uuid-123",
  slug: "jane-smith",
  name: "Jane Smith",
  cv_text: "Professor of Climate Science...",
  enriched_profile: {
    name: "Jane Smith",
    institution: "UCL",
    disciplinary_fields: ["environmental science"],
    research_themes: ["climate adaptation"],
    geographic_focus: ["UK"],
    retrieval_summary: "Dr Jane Smith is a climate researcher at UCL.",
  },
  pipeline_state: { intake: true, profile: true, enrich: true },
  publications_md: "## Publications...",
  match_results_md: null,
  scholar_candidate: null,
};

function makePostRequest(): Request {
  return new Request("http://localhost/api/session/jane-smith/scan", { method: "POST" });
}

function makePatchRequest(): Request {
  return new Request("http://localhost/api/session/jane-smith/scan", { method: "PATCH" });
}

describe("POST /api/session/[name]/scan (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads researcher profile from DB for context injection", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    const reader = stream.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;

    expect(mockGetResearcherFull).toHaveBeenCalledWith("jane-smith", "user-123");
  });

  it("gets URL list from DB via getScanUrlList", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    const reader = stream.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;

    expect(mockGetScanUrlList).toHaveBeenCalled();
  });

  it("sets pipeline_state.scan = true after completion", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    const reader = stream.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;

    expect(mockUpdatePipelineState).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.objectContaining({ scan: true })
    );
  });

  it("persists results in-memory without filesystem", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    const reader = stream.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;

    // persistDiscoveredResults called with in-memory array, not a file path
    expect(mockPersistDiscoveredResults).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ researcher: "jane-smith" })
    );
  });
});

describe("PATCH /api/session/[name]/scan (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sets pipeline_state.scan = true (skip scan)", async () => {
    const res = await PATCH(makePatchRequest(), { params: { name: "jane-smith" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockUpdatePipelineState).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.objectContaining({ scan: true })
    );
  });
});
