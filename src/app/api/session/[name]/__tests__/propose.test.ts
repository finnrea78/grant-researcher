// src/app/api/session/[name]/__tests__/propose.test.ts
// Tests that the propose route saves the generated proposal to the DB after streaming.

export {};

const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));

const mockGetOpportunity = jest.fn();
jest.mock("@/lib/opportunity-store", () => ({
  getOpportunityByFunderAndName: mockGetOpportunity,
}));

const mockGetResearcherFull = jest.fn();
jest.mock("@/lib/researcher-store", () => ({
  getResearcherFull: mockGetResearcherFull,
  updatePipelineState: jest.fn().mockResolvedValue(undefined),
}));

const proposalText = "## Strategic Alignment\n\nProposal content here.";
const mockQuery = jest.fn();
jest.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: mockQuery,
}));

jest.mock("@/lib/sse", () => ({
  formatSSEEvent: (event: unknown) => `data: ${JSON.stringify(event)}\n\n`,
  sseResponse: (stream: ReadableStream) =>
    new Response(stream, { headers: { "Content-Type": "text/event-stream" } }),
}));

const mockUpsertProposalBySlug = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/proposal-store", () => ({
  upsertProposalBySlug: mockUpsertProposalBySlug,
  upsertProposal: jest.fn(),
  getProposalsByResearcherSlug: jest.fn(),
}));

jest.mock("@/lib/concurrency", () => ({
  agentQueue: { acquire: jest.fn().mockResolvedValue(undefined), release: jest.fn() },
}));

const fakeOpportunity = {
  id: "opp-uuid",
  name: "Discovery Projects",
  funder_name: "UKRI",
  slug: "discovery-projects",
};

const fakeResearcher = {
  id: "uuid-123",
  slug: "jane-smith",
  name: "Jane Smith",
  cv_text: null,
  enriched_profile: { name: "Jane Smith", institution: "UCL" },
  pipeline_state: {},
  publications_md: null,
  match_results_md: null,
  scholar_candidate: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireUser.mockResolvedValue({ user: { id: "user-1" } });
  mockGetOpportunity.mockResolvedValue(fakeOpportunity);
  mockGetResearcherFull.mockResolvedValue(fakeResearcher);
  // Agent emits the proposal text then a result message
  mockQuery.mockReturnValue({
    [Symbol.asyncIterator]: async function* () {
      yield { type: "assistant", message: { content: [{ type: "text", text: proposalText }] } };
      yield { type: "result", is_error: false, total_cost_usd: 0.001, num_turns: 2 };
    },
  });
});

describe("POST /api/session/[name]/propose", () => {
  it("saves the generated proposal to the database after streaming", async () => {
    const { POST } = await import("@/app/api/session/[name]/propose/route");

    const req = new Request("http://localhost/api/session/jane-smith/propose", {
      method: "POST",
      body: JSON.stringify({ funder: "ukri", scheme: "Discovery Projects" }),
    });

    const res = await POST(req, { params: { name: "jane-smith" } });

    // Drain the stream to trigger the post-stream DB write
    const reader = res.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;

    expect(mockUpsertProposalBySlug).toHaveBeenCalledWith(
      "jane-smith",
      "ukri",
      "discovery-projects",
      expect.stringContaining("Strategic Alignment")
    );
  });

  it("returns 404 when opportunity is not found", async () => {
    mockGetOpportunity.mockResolvedValue(null);

    const { POST } = await import("@/app/api/session/[name]/propose/route");

    const req = new Request("http://localhost/api/session/jane-smith/propose", {
      method: "POST",
      body: JSON.stringify({ funder: "ukri", scheme: "Unknown Scheme" }),
    });

    const res = await POST(req, { params: { name: "jane-smith" } });
    expect(res.status).toBe(404);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockRequireUser.mockRejectedValue(new Response(null, { status: 401 }));

    const { POST } = await import("@/app/api/session/[name]/propose/route");

    const req = new Request("http://localhost/api/session/jane-smith/propose", {
      method: "POST",
      body: JSON.stringify({ funder: "ukri", scheme: "Discovery Projects" }),
    });

    const res = await POST(req, { params: { name: "jane-smith" } });
    expect(res.status).toBe(401);
  });
});
