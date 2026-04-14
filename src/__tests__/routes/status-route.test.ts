/**
 * Phase 3: Tests for status route DB-first rewrite.
 * Replaces 6+ filesystem existsSync checks with a single DB query.
 * Output shape must remain identical for frontend compatibility.
 */

// Mock auth to always pass
jest.mock("@/lib/auth", () => ({
  requireUser: jest.fn().mockResolvedValue({ user: { id: "user-123" }, supabase: {} }),
}));

// Mock the store functions
jest.mock("@/lib/researcher-store", () => ({
  getResearcherFull: jest.fn(),
}));

jest.mock("@/lib/proposal-store", () => ({
  getProposalsByResearcherSlug: jest.fn(),
}));

import { GET } from "@/app/api/session/[name]/status/route";
import { getResearcherFull } from "@/lib/researcher-store";
import { getProposalsByResearcherSlug } from "@/lib/proposal-store";

const mockGetResearcherFull = getResearcherFull as jest.Mock;
const mockListProposals = getProposalsByResearcherSlug as jest.Mock;

function makeRequest(): Request {
  return new Request("http://localhost/api/session/jane-smith/status");
}

describe("GET /api/session/[name]/status (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns all false with no proposals for a fresh researcher", async () => {
    mockGetResearcherFull.mockResolvedValue({ pipeline_state: {}, scholar_candidate: null });
    mockListProposals.mockResolvedValue([]);

    const res = await GET(makeRequest(), { params: { name: "jane-smith" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      profile: false,
      enrich: false,
      scan: false,
      match: false,
      proposals: [],
      scholarCandidate: null,
    });
  });

  it("returns correct flags from pipeline_state", async () => {
    mockGetResearcherFull.mockResolvedValue({ pipeline_state: { profile: true, enrich: true, scan: true, match: false }, scholar_candidate: null });
    mockListProposals.mockResolvedValue([]);

    const res = await GET(makeRequest(), { params: { name: "jane-smith" } });
    const body = await res.json();

    expect(body.profile).toBe(true);
    expect(body.enrich).toBe(true);
    expect(body.scan).toBe(true);
    expect(body.match).toBe(false);
  });

  it("includes scholar_candidate from DB when disambiguation is pending", async () => {
    const candidate = { name: "Jane Smith", orcid: "0000-0001-2345-6789", confidence: 0.95 };
    mockGetResearcherFull.mockResolvedValue({ pipeline_state: { profile: true, enrich: "pending" }, scholar_candidate: candidate });
    mockListProposals.mockResolvedValue([]);

    const res = await GET(makeRequest(), { params: { name: "jane-smith" } });
    const body = await res.json();

    expect(body.scholarCandidate).toEqual(candidate);
  });

  it("lists proposal filenames from DB", async () => {
    mockGetResearcherFull.mockResolvedValue({ pipeline_state: { profile: true, enrich: true, scan: true, match: true }, scholar_candidate: null });
    mockListProposals.mockResolvedValue([
      { funder_slug: "ahrc", scheme_slug: "responsive-mode" },
      { funder_slug: "wellcome", scheme_slug: "discovery" },
    ]);

    const res = await GET(makeRequest(), { params: { name: "jane-smith" } });
    const body = await res.json();

    expect(body.proposals).toEqual([
      "ahrc-responsive-mode.md",
      "wellcome-discovery.md",
    ]);
  });

  it("does not use filesystem at all — all state comes from getResearcherFull", async () => {
    mockGetResearcherFull.mockResolvedValue({ pipeline_state: {}, scholar_candidate: null });
    mockListProposals.mockResolvedValue([]);

    await GET(makeRequest(), { params: { name: "jane-smith" } });

    expect(mockGetResearcherFull).toHaveBeenCalledWith("jane-smith", "user-123");
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
