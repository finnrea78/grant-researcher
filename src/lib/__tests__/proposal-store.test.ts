// src/lib/__tests__/proposal-store.test.ts

// ─── Mock Supabase ────────────────────────────────────────────────────────────

function makeChain(resolveValue: unknown) {
  const c = {
    select: jest.fn(),
    eq: jest.fn(),
    upsert: jest.fn(),
    single: jest.fn(),
    then: jest.fn(),
  };
  c.select.mockReturnValue(c);
  c.eq.mockReturnValue(c);
  c.upsert.mockReturnValue(c);
  c.single.mockReturnValue(Promise.resolve(resolveValue));
  c.then.mockImplementation((resolve: (v: unknown) => void) => {
    resolve(resolveValue);
    return Promise.resolve(resolveValue);
  });
  return c;
}

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

import { upsertProposal, upsertProposalBySlug, getProposalsByResearcherSlug } from "@/lib/proposal-store";

beforeEach(() => jest.clearAllMocks());

// ─── upsertProposal ───────────────────────────────────────────────────────────

describe("upsertProposal", () => {
  it("upserts a proposal row with the correct fields", async () => {
    const chain = makeChain({ error: null });
    mockFrom.mockReturnValue(chain);

    await upsertProposal("researcher-uuid-123", "ukri", "discovery-projects", "## Proposal content");

    expect(mockFrom).toHaveBeenCalledWith("researcher_proposals");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        researcher_id: "researcher-uuid-123",
        funder_slug: "ukri",
        scheme_slug: "discovery-projects",
        content: "## Proposal content",
      }),
      expect.objectContaining({ onConflict: "researcher_id,funder_slug,scheme_slug" })
    );
  });

  it("throws when Supabase returns an error", async () => {
    const chain = makeChain({ error: { message: "RLS violation" } });
    mockFrom.mockReturnValue(chain);

    await expect(
      upsertProposal("researcher-uuid-123", "ukri", "discovery-projects", "content")
    ).rejects.toThrow("RLS violation");
  });
});

// ─── upsertProposalBySlug ─────────────────────────────────────────────────────

describe("upsertProposalBySlug", () => {
  it("looks up researcher id by slug then upserts the proposal", async () => {
    const researcherChain = makeChain({ data: { id: "researcher-uuid-123" }, error: null });
    const upsertChain = makeChain({ error: null });
    mockFrom
      .mockReturnValueOnce(researcherChain)
      .mockReturnValueOnce(upsertChain);

    await upsertProposalBySlug("jane-smith", "ukri", "discovery-projects", "## Proposal");

    expect(mockFrom).toHaveBeenCalledWith("researchers");
    expect(mockFrom).toHaveBeenCalledWith("researcher_proposals");
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        researcher_id: "researcher-uuid-123",
        funder_slug: "ukri",
        scheme_slug: "discovery-projects",
      }),
      expect.anything()
    );
  });

  it("throws when researcher slug does not exist", async () => {
    const researcherChain = makeChain({ data: null, error: { message: "Not found" } });
    mockFrom.mockReturnValueOnce(researcherChain);

    await expect(
      upsertProposalBySlug("ghost", "ukri", "discovery-projects", "content")
    ).rejects.toThrow("Researcher ghost not found");
  });
});

// ─── getProposalsByResearcherSlug ─────────────────────────────────────────────

describe("getProposalsByResearcherSlug", () => {
  it("looks up researcher by slug then fetches their proposals", async () => {
    const rows = [
      {
        funder_slug: "ukri",
        scheme_slug: "discovery-projects",
        content: "## Proposal A",
        updated_at: "2026-04-08T10:00:00Z",
      },
      {
        funder_slug: "wellcome",
        scheme_slug: "investigator-awards",
        content: "## Proposal B",
        updated_at: "2026-04-07T09:00:00Z",
      },
    ];

    const researcherChain = makeChain({ data: { id: "researcher-uuid-123" }, error: null });
    const proposalChain = makeChain({ data: rows, error: null });
    mockFrom
      .mockReturnValueOnce(researcherChain)
      .mockReturnValueOnce(proposalChain);

    const result = await getProposalsByResearcherSlug("jane-smith");

    expect(mockFrom).toHaveBeenCalledWith("researchers");
    expect(mockFrom).toHaveBeenCalledWith("researcher_proposals");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      funder_slug: "ukri",
      scheme_slug: "discovery-projects",
      content: "## Proposal A",
    });
  });

  it("returns empty array when researcher has no proposals", async () => {
    const researcherChain = makeChain({ data: { id: "researcher-uuid-123" }, error: null });
    const proposalChain = makeChain({ data: [], error: null });
    mockFrom
      .mockReturnValueOnce(researcherChain)
      .mockReturnValueOnce(proposalChain);

    const result = await getProposalsByResearcherSlug("new-researcher");
    expect(result).toEqual([]);
  });

  it("returns empty array when researcher slug does not exist", async () => {
    const researcherChain = makeChain({ data: null, error: { message: "Not found" } });
    mockFrom.mockReturnValueOnce(researcherChain);

    const result = await getProposalsByResearcherSlug("ghost");
    expect(result).toEqual([]);
  });

  it("throws when proposals query fails", async () => {
    const researcherChain = makeChain({ data: { id: "researcher-uuid-123" }, error: null });
    const proposalChain = makeChain({ data: null, error: { message: "Query failed" } });
    mockFrom
      .mockReturnValueOnce(researcherChain)
      .mockReturnValueOnce(proposalChain);

    await expect(getProposalsByResearcherSlug("jane-smith")).rejects.toThrow("Query failed");
  });
});
