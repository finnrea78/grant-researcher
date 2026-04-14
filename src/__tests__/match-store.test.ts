/**
 * Phase 2: Tests for match-store module.
 * Structured match scores persistence replacing filesystem matches.md.
 */

import {
  upsertMatch,
  upsertMatchBatch,
  getMatches,
  deleteMatchesForResearcher,
} from "@/lib/match-store";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
const fromMock = supabase.from as jest.Mock;

function makeChain(result: { data?: unknown; error?: unknown }) {
  const resultPromise = Promise.resolve(result);
  const single: jest.Mock = jest.fn(() => resultPromise);
  const order: jest.Mock = jest.fn(() => resultPromise);
  const eq: jest.Mock = jest.fn(() => Object.assign(resultPromise, { eq, single, order }));
  const select: jest.Mock = jest.fn(() => Object.assign(resultPromise, { eq, single, order }));
  const upsert: jest.Mock = jest.fn(() => resultPromise);
  const del: jest.Mock = jest.fn(() => Object.assign(resultPromise, { eq }));
  return { select, upsert, eq, single, order, delete: del };
}

const RESEARCHER_ID = "researcher-uuid-123";

const sampleMatch = {
  researcher_id: RESEARCHER_ID,
  opportunity_id: null,
  funder_slug: "ahrc",
  scheme_slug: "responsive-mode",
  score_overall: 7.5,
  score_thematic: 8.0,
  score_track_record: 7.0,
  score_strategic: 7.5,
  score_practical: 7.5,
  eligible: true,
  tier: "strong" as const,
  why: "Strong thematic alignment",
  strengths: ["Interdisciplinary approach"],
  weaknesses: ["Limited track record"],
  action: "Apply in next round",
  urgent: false,
  amount_raw: "£100,000",
  deadline_raw: "2026-06-01",
  url: "https://ahrc.ukri.org",
};

describe("upsertMatch", () => {
  beforeEach(() => jest.clearAllMocks());

  it("upserts a single match into researcher_matches", async () => {
    const chain = makeChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    await upsertMatch(sampleMatch);

    expect(fromMock).toHaveBeenCalledWith("researcher_matches");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        researcher_id: RESEARCHER_ID,
        funder_slug: "ahrc",
        scheme_slug: "responsive-mode",
        score_overall: 7.5,
      }),
      expect.objectContaining({ onConflict: "researcher_id,funder_slug,scheme_slug" })
    );
  });

  it("throws on DB error", async () => {
    const chain = makeChain({ data: null, error: { message: "constraint violation" } });
    fromMock.mockReturnValue(chain);

    await expect(upsertMatch(sampleMatch)).rejects.toThrow("constraint violation");
  });
});

describe("upsertMatchBatch", () => {
  beforeEach(() => jest.clearAllMocks());

  it("upserts multiple matches in one call, mapping researcherId onto each score", async () => {
    const chain = makeChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    const { researcher_id: _id, ...scoreWithoutId } = sampleMatch;
    const scores = [
      scoreWithoutId,
      { ...scoreWithoutId, funder_slug: "wellcome", scheme_slug: "discovery", score_overall: 6.0 },
    ];

    await upsertMatchBatch(RESEARCHER_ID, scores);

    expect(fromMock).toHaveBeenCalledWith("researcher_matches");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ funder_slug: "ahrc", researcher_id: RESEARCHER_ID }),
        expect.objectContaining({ funder_slug: "wellcome", researcher_id: RESEARCHER_ID }),
      ]),
      expect.objectContaining({ onConflict: "researcher_id,funder_slug,scheme_slug" })
    );
  });

  it("does nothing when given an empty array", async () => {
    const chain = makeChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    await upsertMatchBatch(RESEARCHER_ID, []);

    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("getMatches", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns all matches for a researcher", async () => {
    const rows = [
      { ...sampleMatch, id: "match-1", created_at: new Date().toISOString() },
    ];
    const chain = makeChain({ data: rows, error: null });
    fromMock.mockReturnValue(chain);

    const result = await getMatches(RESEARCHER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].funder_slug).toBe("ahrc");
    expect(fromMock).toHaveBeenCalledWith("researcher_matches");
    expect(chain.eq).toHaveBeenCalledWith("researcher_id", RESEARCHER_ID);
  });

  it("returns empty array when no matches found", async () => {
    const chain = makeChain({ data: [], error: null });
    fromMock.mockReturnValue(chain);

    const result = await getMatches(RESEARCHER_ID);

    expect(result).toEqual([]);
  });

  it("throws on DB error", async () => {
    const chain = makeChain({ data: null, error: { message: "Connection error" } });
    fromMock.mockReturnValue(chain);

    await expect(getMatches(RESEARCHER_ID)).rejects.toThrow("Connection error");
  });
});

describe("deleteMatchesForResearcher", () => {
  beforeEach(() => jest.clearAllMocks());

  it("deletes all matches for a researcher", async () => {
    const chain = makeChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    await deleteMatchesForResearcher(RESEARCHER_ID);

    expect(fromMock).toHaveBeenCalledWith("researcher_matches");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("researcher_id", RESEARCHER_ID);
  });

  it("throws on DB error", async () => {
    const chain = makeChain({ data: null, error: { message: "Delete failed" } });
    fromMock.mockReturnValue(chain);

    await expect(deleteMatchesForResearcher(RESEARCHER_ID)).rejects.toThrow("Delete failed");
  });
});
