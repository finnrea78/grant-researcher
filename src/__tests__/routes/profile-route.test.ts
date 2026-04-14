/**
 * Phase 5: Tests for profile GET/POST route DB-first rewrite.
 * GET: reads enriched_profile from DB (replaces readFileSync(profile.json))
 * POST: injects intake+cv_text+proposalIntent from DB, writes results back to DB
 *       (replaces all fs reads/writes)
 */

jest.mock("@/lib/auth", () => ({
  requireUser: jest.fn().mockResolvedValue({ user: { id: "user-123" }, supabase: {} }),
}));

jest.mock("@/lib/researcher-store", () => ({
  getResearcherFull: jest.fn(),
  updateResearcherProfile: jest.fn().mockResolvedValue(undefined),
  updatePublicationsMd: jest.fn().mockResolvedValue(undefined),
  updatePipelineState: jest.fn().mockResolvedValue(undefined),
  updateProfileEmbedding: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/concurrency", () => ({
  agentQueue: { acquire: jest.fn().mockResolvedValue(undefined), release: jest.fn() },
}));

const mockAgentMessages = [
  {
    type: "assistant",
    message: {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            profile: {
              name: "Jane Smith",
              institution: "UCL",
              research_themes: ["climate"],
              retrieval_summary: "Dr Jane Smith is a climate researcher.",
            },
            publications_md: "## Publications\n\n- Smith 2024...",
          }),
        },
      ],
    },
  },
  {
    type: "result",
    is_error: false,
    total_cost_usd: 0.001,
    num_turns: 1,
  },
];

jest.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: jest.fn().mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      for (const msg of mockAgentMessages) yield msg;
    },
  }),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

import { GET, POST } from "@/app/api/session/[name]/profile/route";
import {
  getResearcherFull,
  updateResearcherProfile,
  updatePublicationsMd,
  updatePipelineState,
} from "@/lib/researcher-store";
import * as fs from "fs";

const mockGetResearcherFull = getResearcherFull as jest.Mock;
const mockUpdateResearcherProfile = updateResearcherProfile as jest.Mock;
const mockUpdatePublicationsMd = updatePublicationsMd as jest.Mock;
const mockUpdatePipelineState = updatePipelineState as jest.Mock;
const mockWriteFileSync = fs.writeFileSync as jest.Mock;
const mockExistsSync = fs.existsSync as jest.Mock;

const RESEARCHER = {
  id: "uuid-123",
  slug: "jane-smith",
  name: "Jane Smith",
  cv_text: "Professor of Climate Science...",
  enriched_profile: {
    name: "Jane Smith",
    institution: "UCL",
    research_themes: ["climate"],
    retrieval_summary: "Dr Jane Smith is a climate researcher.",
  },
  pipeline_state: { intake: true },
  proposal_intent: { themes: ["climate"] },
  publications_md: "## Publications\n\n- Smith 2024...",
  match_results_md: null,
  scholar_candidate: null,
};

function makeRequest(method = "GET"): Request {
  return new Request("http://localhost/api/session/jane-smith/profile", { method });
}

describe("GET /api/session/[name]/profile (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns enriched_profile from DB", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const res = await GET(makeRequest(), { params: { name: "jane-smith" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profile).toEqual(RESEARCHER.enriched_profile);
  });

  it("returns 404 when enriched_profile is null", async () => {
    mockGetResearcherFull.mockResolvedValue({ ...RESEARCHER, enriched_profile: null });

    const res = await GET(makeRequest(), { params: { name: "jane-smith" } });
    expect(res.status).toBe(404);
  });

  it("returns 404 when researcher not found", async () => {
    mockGetResearcherFull.mockResolvedValue(null);

    const res = await GET(makeRequest(), { params: { name: "unknown" } });
    expect(res.status).toBe(404);
  });

  it("does not use filesystem", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    await GET(makeRequest(), { params: { name: "jane-smith" } });

    expect(mockExistsSync).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    const { requireUser } = require("@/lib/auth");
    (requireUser as jest.Mock).mockRejectedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );

    const res = await GET(makeRequest(), { params: { name: "jane-smith" } });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/session/[name]/profile (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("writes profile to DB via updateResearcherProfile", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makeRequest("POST"), { params: { name: "jane-smith" } });
    const reader = stream.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;

    expect(mockUpdateResearcherProfile).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.objectContaining({ name: "Jane Smith" })
    );
  });

  it("writes publications_md to DB via updatePublicationsMd", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makeRequest("POST"), { params: { name: "jane-smith" } });
    const reader = stream.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;

    expect(mockUpdatePublicationsMd).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.stringContaining("Publications")
    );
  });

  it("sets pipeline_state.profile = true after completion", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makeRequest("POST"), { params: { name: "jane-smith" } });
    const reader = stream.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;

    expect(mockUpdatePipelineState).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.objectContaining({ profile: true })
    );
  });

  it("does not write to filesystem", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const stream = await POST(makeRequest("POST"), { params: { name: "jane-smith" } });
    const reader = stream.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });
});
