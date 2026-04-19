/**
 * Phase 6: Tests for match POST route DB-first rewrite.
 * - Remove Read/Write from allowedTools; inject profile from DB
 * - Agent outputs JSON scores as text
 * - parseAgentScores() extracts JSON array from agent text
 * - upsertMatchBatch() + updateMatchResultsMd() + updatePipelineState()
 * - proposal_intent cleared from pipeline_state after matching
 */

jest.mock("@/lib/auth", () => ({
  requireUser: jest.fn().mockResolvedValue({ user: { id: "user-123" }, supabase: {} }),
}));

jest.mock("@/lib/researcher-store", () => ({
  getResearcherFull: jest.fn(),
  updateMatchResultsMd: jest.fn().mockResolvedValue(undefined),
  updatePipelineState: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/match-store", () => ({
  upsertMatchBatch: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/opportunity-retrieval", () => ({
  retrieveCandidates: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/concurrency", () => ({
  agentQueue: { acquire: jest.fn().mockResolvedValue(undefined), release: jest.fn() },
}));

const mockScores = [
  {
    funder_slug: "ahrc",
    scheme_slug: "responsive-mode",
    score_overall: 7.5,
    score_thematic: 8,
    score_track_record: 7,
    score_strategic: 7,
    score_practical: 7,
    eligible: true,
    tier: "strong",
    why: "Strong thematic alignment with AHRC priorities.",
    strengths: ["Interdisciplinary approach"],
    weaknesses: [],
    action: "Apply now",
    urgent: false,
    amount_raw: "£500k",
    deadline_raw: "2026-06-01",
    url: "https://ahrc.ukri.org",
  },
];

jest.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield {
        type: "assistant",
        message: {
          content: [{ type: "text", text: JSON.stringify(mockScores) }],
        },
      };
      yield { type: "result", is_error: false, total_cost_usd: 0.01, num_turns: 5 };
    },
  }),
}));

jest.mock("fs", () => ({
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

import { POST } from "@/app/api/session/[name]/match/route";
import { getResearcherFull, updateMatchResultsMd, updatePipelineState } from "@/lib/researcher-store";
import { upsertMatchBatch } from "@/lib/match-store";
import { query } from "@anthropic-ai/claude-agent-sdk";
import * as fs from "fs";

const mockGetResearcherFull = getResearcherFull as jest.Mock;
const mockUpsertMatchBatch = upsertMatchBatch as jest.Mock;
const mockUpdateMatchResultsMd = updateMatchResultsMd as jest.Mock;
const mockUpdatePipelineState = updatePipelineState as jest.Mock;
const mockMkdirSync = fs.mkdirSync as jest.Mock;
const mockQuery = query as jest.Mock;

const RESEARCHER = {
  id: "uuid-123",
  slug: "jane-smith",
  name: "Jane Smith",
  cv_text: null,
  enriched_profile: {
    name: "Jane Smith",
    institution: "UCL",
    research_themes: ["climate"],
    retrieval_summary: "Dr Jane Smith is a climate researcher.",
  },
  pipeline_state: {
    intake: true,
    profile: true,
    enrich: true,
    scan: true,
  },
  proposal_intent: { project_title: "Climate Research", description: "Studying climate adaptation" },
  publications_md: null,
  match_results_md: null,
  scholar_candidate: null,
};

function makeRequest(): Request {
  return new Request("http://localhost/api/session/jane-smith/match", { method: "POST" });
}

async function drainStream(res: Response): Promise<void> {
  const reader = res.body!.getReader();
  let done = false;
  while (!done) done = (await reader.read()).done;
}

describe("POST /api/session/[name]/match (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("stores match scores in DB via upsertMatchBatch", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const res = await POST(makeRequest(), { params: { name: "jane-smith" } });
    await drainStream(res);

    expect(mockUpsertMatchBatch).toHaveBeenCalledWith(
      "uuid-123",
      expect.arrayContaining([
        expect.objectContaining({ funder_slug: "ahrc", score_overall: 7.5 }),
      ])
    );
  });

  it("saves match results markdown to DB", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const res = await POST(makeRequest(), { params: { name: "jane-smith" } });
    await drainStream(res);

    expect(mockUpdateMatchResultsMd).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.any(String)
    );
  });

  it("sets pipeline_state.match = true with userId", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const res = await POST(makeRequest(), { params: { name: "jane-smith" } });
    await drainStream(res);

    expect(mockUpdatePipelineState).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.objectContaining({ match: true })
    );
  });

  it("does not clear proposal_intent from pipeline_state after matching", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const res = await POST(makeRequest(), { params: { name: "jane-smith" } });
    await drainStream(res);

    // proposal_intent now lives in researchers.proposal_intent column, not pipeline_state
    expect(mockUpdatePipelineState).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.not.objectContaining({ proposal_intent: expect.anything() })
    );
  });

  it("does not use Read or Write agent tools", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const res = await POST(makeRequest(), { params: { name: "jane-smith" } });
    await drainStream(res);

    const queryCall = mockQuery.mock.calls[0][0];
    expect(queryCall.options.allowedTools).not.toContain("Read");
    expect(queryCall.options.allowedTools).not.toContain("Write");
  });

  it("uses Haiku model for cost reduction", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const res = await POST(makeRequest(), { params: { name: "jane-smith" } });
    await drainStream(res);

    const queryCall = mockQuery.mock.calls[0][0];
    expect(queryCall.options.model).toBe("claude-haiku-4-5-20251001");
  });

  it("uses maxTurns: 1 for single-pass scoring", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const res = await POST(makeRequest(), { params: { name: "jane-smith" } });
    await drainStream(res);

    const queryCall = mockQuery.mock.calls[0][0];
    expect(queryCall.options.maxTurns).toBe(1);
  });

  it("does not use mkdirSync", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const res = await POST(makeRequest(), { params: { name: "jane-smith" } });
    await drainStream(res);

    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    const { requireUser } = require("@/lib/auth");
    (requireUser as jest.Mock).mockRejectedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );

    const res = await POST(makeRequest(), { params: { name: "jane-smith" } });
    expect(res.status).toBe(401);
  });
});
