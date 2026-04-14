// src/lib/__tests__/opportunity-retrieval.test.ts

// ─── Mock Supabase ────────────────────────────────────────────────────────────
const mockRpc = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { rpc: mockRpc },
}));

// ─── Mock researcher-store ────────────────────────────────────────────────────
const mockGetResearcher = jest.fn();
jest.mock("@/lib/researcher-store", () => ({
  getResearcherForMatching: mockGetResearcher,
}));

import { retrieveCandidates } from "@/lib/opportunity-retrieval";

const FAKE_EMBEDDING = Array(1536).fill(0.1);

const VECTOR_OPP = {
  id: "opp-1", funder_id: "f-1", name: "Ecology Grant", slug: "ecology-grant",
  status: "open", description: "Fund ecology research", eligibility: null,
  scope: "Environment", amount_raw: null, amount_min: null, amount_max: null,
  amount_currency: "GBP", deadline_raw: null, deadline_date: null,
  url: null, funding_type: "grant", source: "ukri_funding_finder", similarity: 0.8,
};

const FTS_OPP = {
  id: "opp-2", funder_id: "f-2", name: "Climate Fellowship", slug: "climate-fellowship",
  status: "open", description: null, eligibility: null, scope: null,
  amount_raw: null, amount_min: null, amount_max: null, amount_currency: "GBP",
  deadline_raw: null, deadline_date: null, url: null, funding_type: "fellowship",
  source: "wellcome", rank: 0.5,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("retrieveCandidates", () => {
  it("runs both pgvector and tsvector paths when profile_embedding exists", async () => {
    mockGetResearcher.mockResolvedValue({
      profile_embedding: FAKE_EMBEDDING,
      research_themes: ["ecology"],
      research_keywords: ["climate"],
    });
    mockRpc
      .mockResolvedValueOnce({ data: [VECTOR_OPP], error: null }) // match_opportunities
      .mockResolvedValueOnce({ data: [FTS_OPP], error: null });   // search_opportunities_fts

    const results = await retrieveCandidates("jane-smith", "user-123");

    expect(mockRpc).toHaveBeenCalledWith("match_opportunities", expect.objectContaining({
      query_embedding: FAKE_EMBEDDING,
    }));
    expect(mockRpc).toHaveBeenCalledWith("search_opportunities_fts", expect.objectContaining({
      search_query: expect.stringContaining("|"),
    }));
    expect(results).toHaveLength(2);
  });

  it("deduplicates by id when both paths return the same opportunity", async () => {
    mockGetResearcher.mockResolvedValue({
      profile_embedding: FAKE_EMBEDDING,
      research_themes: ["ecology"],
      research_keywords: [],
    });
    const DUPLICATE = { ...FTS_OPP, id: "opp-1" }; // same id as VECTOR_OPP
    mockRpc
      .mockResolvedValueOnce({ data: [VECTOR_OPP], error: null })
      .mockResolvedValueOnce({ data: [DUPLICATE], error: null });

    const results = await retrieveCandidates("jane-smith", "user-123");

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("opp-1");
  });

  it("falls back to tsvector-only when profile_embedding is null", async () => {
    mockGetResearcher.mockResolvedValue({
      profile_embedding: null,
      research_themes: ["marine"],
      research_keywords: ["acoustics"],
    });
    mockRpc.mockResolvedValueOnce({ data: [FTS_OPP], error: null });

    const results = await retrieveCandidates("jane-smith", "user-123");

    // Only one rpc call (fts only)
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("search_opportunities_fts", expect.any(Object));
    expect(results).toHaveLength(1);
  });

  it("caps results at provided limit", async () => {
    mockGetResearcher.mockResolvedValue({
      profile_embedding: null,
      research_themes: ["ecology"],
      research_keywords: [],
    });
    const manyOpps = Array.from({ length: 200 }, (_, i) => ({ ...FTS_OPP, id: `opp-${i}` }));
    mockRpc.mockResolvedValueOnce({ data: manyOpps, error: null });

    const results = await retrieveCandidates("jane-smith", "user-123", 50);
    expect(results.length).toBeLessThanOrEqual(50);
  });

  it("returns empty array when both paths return no results", async () => {
    mockGetResearcher.mockResolvedValue({
      profile_embedding: null,
      research_themes: [],
      research_keywords: [],
    });
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const results = await retrieveCandidates("jane-smith", "user-123");
    expect(results).toEqual([]);
  });

  it("throws when researcher fetch fails", async () => {
    mockGetResearcher.mockRejectedValue(new Error("Not found"));
    await expect(retrieveCandidates("ghost", "user-123")).rejects.toThrow("Not found");
  });
});
