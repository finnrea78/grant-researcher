/**
 * Phase 6: Tests for propose POST route DB-first rewrite.
 * - Remove Write from allowedTools; inject profile from DB
 * - Capture agent text output directly (no file write/read roundtrip)
 * - upsertProposalBySlug() called with captured text
 * - No mkdirSync or readFileSync
 */

jest.mock("@/lib/auth", () => ({
  requireUser: jest.fn().mockResolvedValue({ user: { id: "user-123" }, supabase: {} }),
}));

jest.mock("@/lib/researcher-store", () => ({
  getResearcherFull: jest.fn(),
  updatePipelineState: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/proposal-store", () => ({
  upsertProposalBySlug: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/opportunity-store", () => ({
  getOpportunityByFunderAndName: jest.fn().mockResolvedValue({
    id: "opp-uuid-1",
    funder_name: "AHRC",
    name: "Responsive Mode",
    description: "Funding for arts and humanities research.",
    deadline_raw: "2026-06-01",
    amount_raw: "up to £500k",
    eligibility: "UK HEI researchers",
    scope: "Arts and humanities",
    url: "https://ahrc.ukri.org",
  }),
}));

jest.mock("@/lib/concurrency", () => ({
  agentQueue: { acquire: jest.fn().mockResolvedValue(undefined), release: jest.fn() },
}));

const proposalText = `# Strategic Alignment: UCL Climate Research → AHRC Responsive Mode

## Overview
This proposal outlines the strategic alignment...`;

jest.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield {
        type: "assistant",
        message: { content: [{ type: "text", text: proposalText }] },
      };
      yield { type: "result", is_error: false, total_cost_usd: 0.005, num_turns: 3 };
    },
  }),
}));

jest.mock("fs", () => ({
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

import { POST } from "@/app/api/session/[name]/propose/route";
import { getResearcherFull } from "@/lib/researcher-store";
import { upsertProposalBySlug } from "@/lib/proposal-store";
import { query } from "@anthropic-ai/claude-agent-sdk";
import * as fs from "fs";

const mockGetResearcherFull = getResearcherFull as jest.Mock;
const mockUpsertProposal = upsertProposalBySlug as jest.Mock;
const mockMkdirSync = fs.mkdirSync as jest.Mock;
const mockReadFileSync = fs.readFileSync as jest.Mock;
const mockQuery = query as jest.Mock;

const RESEARCHER = {
  id: "uuid-123",
  slug: "jane-smith",
  name: "Jane Smith",
  cv_text: null,
  enriched_profile: {
    name: "Jane Smith",
    institution: "UCL",
    research_themes: ["climate adaptation"],
    retrieval_summary: "Dr Jane Smith researches climate adaptation at UCL.",
  },
  pipeline_state: { intake: true, profile: true, enrich: true, scan: true, match: true },
  publications_md: "## Publications...",
  match_results_md: null,
  scholar_candidate: null,
};

function makeRequest(funder = "ahrc", scheme = "Responsive Mode"): Request {
  return new Request("http://localhost/api/session/jane-smith/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ funder, scheme }),
  });
}

async function drainStream(res: Response): Promise<void> {
  const reader = res.body!.getReader();
  let done = false;
  while (!done) done = (await reader.read()).done;
}

describe("POST /api/session/[name]/propose (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("saves proposal content to DB via upsertProposalBySlug", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const res = await POST(makeRequest(), { params: { name: "jane-smith" } });
    await drainStream(res);

    expect(mockUpsertProposal).toHaveBeenCalledWith(
      "jane-smith",
      "ahrc",
      "responsive-mode",
      expect.stringContaining("Strategic Alignment")
    );
  });

  it("does not use Write agent tool", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const res = await POST(makeRequest(), { params: { name: "jane-smith" } });
    await drainStream(res);

    const queryCall = mockQuery.mock.calls[0][0];
    expect(queryCall.options.allowedTools).not.toContain("Write");
  });

  it("does not use mkdirSync or readFileSync", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const res = await POST(makeRequest(), { params: { name: "jane-smith" } });
    await drainStream(res);

    expect(mockMkdirSync).not.toHaveBeenCalled();
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it("returns 400 when funder or scheme is missing", async () => {
    const req = new Request("http://localhost/api/session/jane-smith/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funder: "ahrc" }), // missing scheme
    });

    const res = await POST(req, { params: { name: "jane-smith" } });
    expect(res.status).toBe(400);
  });

  it("returns 404 when opportunity not found in DB", async () => {
    const { getOpportunityByFunderAndName } = require("@/lib/opportunity-store");
    (getOpportunityByFunderAndName as jest.Mock).mockResolvedValueOnce(null);

    const res = await POST(makeRequest(), { params: { name: "jane-smith" } });
    expect(res.status).toBe(404);
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
