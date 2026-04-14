/**
 * Phase 5: Tests for scan POST/PATCH route DB-first rewrite.
 * POST: reads researcher profile from DB (replaces readFileSync(profile.json)),
 *       marks scan complete via updatePipelineState (replaces writeFileSync(_scan-complete))
 * PATCH: marks scan complete via updatePipelineState (replaces writeFileSync(_scan-complete))
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
}));

jest.mock("@/lib/scan-persistence", () => ({
  persistDiscoveredManifest: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/scan-extract", () => ({
  extractAll: jest.fn().mockResolvedValue({ results: [], failed: [] }),
}));

jest.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield {
        type: "assistant",
        message: { content: [{ type: "text", text: "Scan plan complete." }] },
      };
      yield { type: "result", is_error: false, total_cost_usd: 0.005, num_turns: 3 };
    },
  }),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn().mockReturnValue("[]"),
  writeFileSync: jest.fn(),
}));

import { POST, PATCH } from "@/app/api/session/[name]/scan/route";
import { getResearcherFull, updatePipelineState } from "@/lib/researcher-store";
import * as fs from "fs";

const mockGetResearcherFull = getResearcherFull as jest.Mock;
const mockUpdatePipelineState = updatePipelineState as jest.Mock;
const mockWriteFileSync = fs.writeFileSync as jest.Mock;

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

  it("sets pipeline_state.scan = true after completion", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);
    // Mock readFileSync to return a scan plan with one URL so Phase 2 runs
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({ urls: [{ slug: "ahrc", url: "https://ahrc.ukri.org" }] })
    );

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

  it("does not write _scan-complete file", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({ urls: [{ slug: "ahrc", url: "https://ahrc.ukri.org" }] })
    );

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    const reader = stream.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;

    // Should not write researcher-specific _scan-complete file
    const scanCompleteWrites = (mockWriteFileSync as jest.Mock).mock.calls.filter(
      ([path]: [string]) => typeof path === "string" && path.includes("_scan-complete")
    );
    expect(scanCompleteWrites).toHaveLength(0);
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

  it("does not write _scan-complete file", async () => {
    await PATCH(makePatchRequest(), { params: { name: "jane-smith" } });

    const scanCompleteWrites = (mockWriteFileSync as jest.Mock).mock.calls.filter(
      ([path]: [string]) => typeof path === "string" && path.includes("_scan-complete")
    );
    expect(scanCompleteWrites).toHaveLength(0);
  });
});
