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

import { upsertProposal, getProposals } from "@/lib/proposal-store";

beforeEach(() => jest.clearAllMocks());

// ─── upsertProposal ───────────────────────────────────────────────────────────

describe("upsertProposal", () => {
  it("resolves researcher UUID then upserts into researcher_proposals", async () => {
    const lookupChain = makeChain({ data: { id: "uuid-123" }, error: null });
    const upsertChain = makeChain({ error: null });
    mockFrom
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(upsertChain);

    await upsertProposal("jane-smith", "ukri", "responsive-mode", "Proposal text here.");

    expect(mockFrom).toHaveBeenNthCalledWith(1, "researchers");
    expect(lookupChain.select).toHaveBeenCalledWith("id");
    expect(lookupChain.eq).toHaveBeenCalledWith("slug", "jane-smith");

    expect(mockFrom).toHaveBeenNthCalledWith(2, "researcher_proposals");
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      {
        researcher_id: "uuid-123",
        funder_slug: "ukri",
        scheme_slug: "responsive-mode",
        content: "Proposal text here.",
      },
      { onConflict: "researcher_id,funder_slug,scheme_slug" }
    );
  });

  it("throws when researcher is not found (data is null)", async () => {
    const lookupChain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(lookupChain);

    await expect(
      upsertProposal("ghost", "ukri", "responsive-mode", "text")
    ).rejects.toThrow("Researcher not found: ghost");
  });

  it("throws when lookup returns an error", async () => {
    const lookupChain = makeChain({ data: null, error: { message: "Lookup failed" } });
    mockFrom.mockReturnValueOnce(lookupChain);

    await expect(
      upsertProposal("jane-smith", "ukri", "responsive-mode", "text")
    ).rejects.toThrow("Researcher not found: jane-smith");
  });

  it("throws when upsert returns an error", async () => {
    const lookupChain = makeChain({ data: { id: "uuid-123" }, error: null });
    const upsertChain = makeChain({ error: { message: "Upsert failed" } });
    mockFrom
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(upsertChain);

    await expect(
      upsertProposal("jane-smith", "ukri", "responsive-mode", "text")
    ).rejects.toThrow("Upsert failed");
  });
});

// ─── getProposals ─────────────────────────────────────────────────────────────

describe("getProposals", () => {
  it("resolves researcher UUID then returns proposals array", async () => {
    const proposals = [
      { funder_slug: "ukri", scheme_slug: "responsive-mode", content: "Proposal A" },
      { funder_slug: "wellcome", scheme_slug: "discovery", content: "Proposal B" },
    ];
    const lookupChain = makeChain({ data: { id: "uuid-123" }, error: null });
    const queryChain = makeChain({ data: proposals, error: null });
    mockFrom
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(queryChain);

    const result = await getProposals("jane-smith");

    expect(mockFrom).toHaveBeenNthCalledWith(1, "researchers");
    expect(lookupChain.select).toHaveBeenCalledWith("id");
    expect(lookupChain.eq).toHaveBeenCalledWith("slug", "jane-smith");

    expect(mockFrom).toHaveBeenNthCalledWith(2, "researcher_proposals");
    expect(queryChain.select).toHaveBeenCalledWith("funder_slug, scheme_slug, content");
    expect(queryChain.eq).toHaveBeenCalledWith("researcher_id", "uuid-123");

    expect(result).toEqual(proposals);
  });

  it("returns empty array when researcher is not found", async () => {
    const lookupChain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(lookupChain);

    const result = await getProposals("ghost");
    expect(result).toEqual([]);
  });

  it("returns empty array when researcher has no proposals (data is null)", async () => {
    const lookupChain = makeChain({ data: { id: "uuid-123" }, error: null });
    const queryChain = makeChain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(queryChain);

    const result = await getProposals("jane-smith");
    expect(result).toEqual([]);
  });

  it("throws when Supabase returns an error on the proposals query", async () => {
    const lookupChain = makeChain({ data: { id: "uuid-123" }, error: null });
    const queryChain = makeChain({ data: null, error: { message: "Query failed" } });
    mockFrom
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(queryChain);

    await expect(getProposals("jane-smith")).rejects.toThrow("Query failed");
  });
});
