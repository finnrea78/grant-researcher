// src/app/api/session/[name]/__tests__/propose.test.ts
// Tests that the propose route saves the generated proposal to the DB after streaming.

export {};

const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));

const mockGetOpportunity = jest.fn();
jest.mock("@/lib/opportunity-store", () => ({
  getOpportunityByFunderAndName: mockGetOpportunity,
}));

const mockQuery = jest.fn();
jest.mock("@anthropic-ai/claude-agent-sdk", () => ({ query: mockQuery }));

// pipeQueryToSSE resolves immediately and closes the controller
const mockPipeQueryToSSE = jest.fn().mockImplementation(
  async (_messages: unknown, controller: ReadableStreamDefaultController<string>) => {
    controller.close();
  }
);
jest.mock("@/lib/sse", () => ({
  pipeQueryToSSE: mockPipeQueryToSSE,
  startHeartbeat: () => 0,
  sseResponse: (stream: ReadableStream) =>
    new Response(stream, { headers: { "Content-Type": "text/event-stream" } }),
}));

const mockUpsertProposalBySlug = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/proposal-store", () => ({
  upsertProposalBySlug: mockUpsertProposalBySlug,
  upsertProposal: jest.fn(),
  getProposalsByResearcherSlug: jest.fn(),
}));

// Stub filesystem
jest.mock("fs", () => ({
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue("## Strategic Alignment\n\nProposal content here."),
}));

jest.mock("path", () => ({
  resolve: (...parts: string[]) => parts.join("/"),
}));

const fakeOpportunity = {
  id: "opp-uuid",
  name: "Discovery Projects",
  funder_name: "UKRI",
  slug: "discovery-projects",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireUser.mockResolvedValue({ user: { id: "user-1" } });
  mockGetOpportunity.mockResolvedValue(fakeOpportunity);
  mockQuery.mockReturnValue((async function* () {})());
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
    await res.text();

    expect(mockUpsertProposalBySlug).toHaveBeenCalledWith(
      "jane-smith",
      "ukri",
      "discovery-projects",
      "## Strategic Alignment\n\nProposal content here."
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
