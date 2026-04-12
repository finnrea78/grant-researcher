/**
 * Phase 5: Tests for enrich POST/PATCH route DB-first rewrite.
 * POST: injects researcher context from DB, agent outputs JSON findings (no file writes)
 * PATCH confirm: clears scholar_candidate, updates researcher identifier in DB
 * PATCH skip: clears scholar_candidate, sets pipeline_state.scholar_skip
 */

jest.mock("@/lib/auth", () => ({
  requireUser: jest.fn().mockResolvedValue({ user: { id: "user-123" }, supabase: {} }),
}));

jest.mock("@/lib/researcher-store", () => ({
  getResearcherFull: jest.fn(),
  upsertResearcher: jest.fn().mockResolvedValue("uuid-123"),
  updateResearcherProfile: jest.fn().mockResolvedValue(undefined),
  updateProfileEmbedding: jest.fn().mockResolvedValue(undefined),
  updateScholarCandidate: jest.fn().mockResolvedValue(undefined),
  updatePipelineState: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/concurrency", () => ({
  agentQueue: { acquire: jest.fn().mockResolvedValue(undefined), release: jest.fn() },
}));

// Agent returns enriched profile + optional scholar candidate as JSON text
const enrichedOutput = {
  enriched_fields: {
    google_scholar_url: null,
    scholar_h_index: null,
    retrieval_summary: "Dr Jane Smith researches climate adaptation...",
  },
  scholar_candidate: {
    candidate_url: "https://scholar.google.com/citations?user=abc123",
    candidate_confidence: "high",
  },
};

jest.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield {
        type: "assistant",
        message: {
          content: [{ type: "text", text: JSON.stringify(enrichedOutput) }],
        },
      };
      yield { type: "result", is_error: false, total_cost_usd: 0.002, num_turns: 5 };
    },
  }),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

import { POST, PATCH } from "@/app/api/session/[name]/enrich/route";
import {
  getResearcherFull,
  updateScholarCandidate,
  updatePipelineState,
  updateResearcherProfile,
} from "@/lib/researcher-store";
import * as fs from "fs";

const mockGetResearcherFull = getResearcherFull as jest.Mock;
const mockUpdateScholarCandidate = updateScholarCandidate as jest.Mock;
const mockUpdatePipelineState = updatePipelineState as jest.Mock;
const mockUpdateResearcherProfile = updateResearcherProfile as jest.Mock;
const mockWriteFileSync = fs.writeFileSync as jest.Mock;
const mockExistsSync = fs.existsSync as jest.Mock;
const mockUnlinkSync = fs.unlinkSync as jest.Mock;

const RESEARCHER = {
  id: "uuid-123",
  slug: "jane-smith",
  name: "Jane Smith",
  cv_text: "Professor of Climate Science...",
  enriched_profile: {
    name: "Jane Smith",
    institution: "UCL",
    research_themes: ["climate"],
  },
  pipeline_state: { intake: true, profile: true },
  publications_md: "## Publications...",
  match_results_md: null,
  scholar_candidate: null,
};

function makePostRequest(): Request {
  return new Request("http://localhost/api/session/jane-smith/enrich", { method: "POST" });
}

function makePatchRequest(body: object): Request {
  return new Request("http://localhost/api/session/jane-smith/enrich", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/session/[name]/enrich (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("stores scholar_candidate from agent output in DB", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    const reader = stream.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;

    expect(mockUpdateScholarCandidate).toHaveBeenCalledWith(
      "jane-smith",
      expect.objectContaining({ candidate_url: expect.any(String) })
    );
  });

  it("sets pipeline_state.enrich = true after completion", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    const reader = stream.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;

    expect(mockUpdatePipelineState).toHaveBeenCalledWith(
      "jane-smith",
      expect.objectContaining({ enrich: true })
    );
  });

  it("does not write to filesystem", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makePostRequest(), { params: { name: "jane-smith" } });
    const reader = stream.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/session/[name]/enrich (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("confirm: clears scholar_candidate in DB", async () => {
    mockGetResearcherFull.mockResolvedValue({
      ...RESEARCHER,
      enriched_profile: {
        ...RESEARCHER.enriched_profile,
        identifiers: {},
      },
    });

    const res = await PATCH(
      makePatchRequest({ confirm: true, scholar_url: "https://scholar.google.com/citations?user=abc123" }),
      { params: { name: "jane-smith" } }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBe("confirmed");
    expect(mockUpdateScholarCandidate).toHaveBeenCalledWith("jane-smith", null);
  });

  it("skip: clears scholar_candidate and sets scholar_skip in pipeline_state", async () => {
    const res = await PATCH(
      makePatchRequest({ confirm: false }),
      { params: { name: "jane-smith" } }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBe("skipped");
    expect(mockUpdateScholarCandidate).toHaveBeenCalledWith("jane-smith", null);
    expect(mockUpdatePipelineState).toHaveBeenCalledWith(
      "jane-smith",
      expect.objectContaining({ scholar_skip: true })
    );
  });

  it("does not use filesystem for confirm or skip", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    await PATCH(makePatchRequest({ confirm: false }), { params: { name: "jane-smith" } });

    expect(mockExistsSync).not.toHaveBeenCalled();
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});
