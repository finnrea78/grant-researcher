// src/app/api/session/[name]/__tests__/proposal.test.ts
// Tests for GET /api/session/[name]/proposal — now reads from DB instead of filesystem.

export {};

const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));

const mockGetProposals = jest.fn();
jest.mock("@/lib/proposal-store", () => ({
  getProposalsByResearcherSlug: mockGetProposals,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireUser.mockResolvedValue({ user: { id: "user-1" } });
});

describe("GET /api/session/[name]/proposal", () => {
  it("returns proposals as { filename, content } from the DB", async () => {
    mockGetProposals.mockResolvedValue([
      { funder_slug: "ukri", scheme_slug: "discovery-projects", content: "## Proposal A", updated_at: "2026-04-08T10:00:00Z" },
      { funder_slug: "wellcome", scheme_slug: "investigator-awards", content: "## Proposal B", updated_at: "2026-04-07T09:00:00Z" },
    ]);

    const { GET } = await import("@/app/api/session/[name]/proposal/route");
    const req = new Request("http://localhost/api/session/jane-smith/proposal");
    const res = await GET(req, { params: { name: "jane-smith" } });
    const body = await res.json();

    expect(mockGetProposals).toHaveBeenCalledWith("jane-smith");
    expect(body.proposals).toHaveLength(2);
    expect(body.proposals[0]).toEqual({
      filename: "ukri-discovery-projects.md",
      content: "## Proposal A",
    });
    expect(body.proposals[1]).toEqual({
      filename: "wellcome-investigator-awards.md",
      content: "## Proposal B",
    });
  });

  it("returns empty proposals array when researcher has none", async () => {
    mockGetProposals.mockResolvedValue([]);

    const { GET } = await import("@/app/api/session/[name]/proposal/route");
    const req = new Request("http://localhost/api/session/new-researcher/proposal");
    const res = await GET(req, { params: { name: "new-researcher" } });
    const body = await res.json();

    expect(body.proposals).toEqual([]);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockRequireUser.mockRejectedValue(new Response(null, { status: 401 }));

    const { GET } = await import("@/app/api/session/[name]/proposal/route");
    const req = new Request("http://localhost/api/session/jane-smith/proposal");
    const res = await GET(req, { params: { name: "jane-smith" } });

    expect(res.status).toBe(401);
  });
});
