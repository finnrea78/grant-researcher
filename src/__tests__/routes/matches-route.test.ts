/**
 * Phase 3: Tests for matches GET route DB-first rewrite.
 * Replaces readFileSync(matches.md) with DB query for match_results_md.
 */

jest.mock("@/lib/auth", () => ({
  requireUser: jest.fn().mockResolvedValue({ user: { id: "user-123" }, supabase: {} }),
}));

jest.mock("@/lib/researcher-store", () => ({
  getResearcherBySlug: jest.fn(),
}));

jest.mock("@/lib/match-store", () => ({
  getMatches: jest.fn(),
}));

import { GET } from "@/app/api/session/[name]/matches/route";
import { getResearcherBySlug } from "@/lib/researcher-store";
import { getMatches } from "@/lib/match-store";

const mockGetResearcher = getResearcherBySlug as jest.Mock;
const mockGetMatches = getMatches as jest.Mock;

function makeRequest(): Request {
  return new Request("http://localhost/api/session/jane-smith/matches");
}

describe("GET /api/session/[name]/matches (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns empty matches when researcher has no match scores", async () => {
    mockGetResearcher.mockResolvedValue({ id: "uuid-123", slug: "jane-smith", name: "Jane Smith", enriched_profile: {} });
    mockGetMatches.mockResolvedValue([]);

    const res = await GET(makeRequest(), { params: { name: "jane-smith" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ matches: [] });
  });

  it("returns structured match data from DB", async () => {
    mockGetResearcher.mockResolvedValue({ id: "uuid-123", slug: "jane-smith", name: "Jane Smith", enriched_profile: {} });
    mockGetMatches.mockResolvedValue([
      {
        id: "match-1",
        researcher_id: "uuid-123",
        opportunity_id: null,
        funder_slug: "ahrc",
        scheme_slug: "responsive-mode",
        score_overall: 7.5,
        tier: "strong",
        eligible: true,
        why: "Strong alignment",
        strengths: ["Interdisciplinary"],
        weaknesses: [],
        action: "Apply",
        urgent: false,
        amount_raw: "£100,000",
        deadline_raw: "2026-06-01",
        url: "https://ahrc.ukri.org",
        created_at: new Date().toISOString(),
      },
    ]);

    const res = await GET(makeRequest(), { params: { name: "jane-smith" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0].funder_slug).toBe("ahrc");
    expect(body.matches[0].score_overall).toBe(7.5);
    expect(mockGetMatches).toHaveBeenCalledWith("uuid-123");
  });

  it("returns 404 when researcher does not exist", async () => {
    mockGetResearcher.mockResolvedValue(null);

    const res = await GET(makeRequest(), { params: { name: "nonexistent" } });
    expect(res.status).toBe(404);
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
