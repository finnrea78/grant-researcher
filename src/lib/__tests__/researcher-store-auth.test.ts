// Tests for auth-related additions to researcher-store.ts:
// - upsertResearcher includes user_id when provided
// - listResearchersWithProfiles and getResearcherBySlug accept an optional client param

// ─── Mock service-role Supabase client ────────────────────────────────────────
const mockServiceFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { from: mockServiceFrom },
}));

// ─── Mock embedder ────────────────────────────────────────────────────────────
jest.mock("@/lib/embedder", () => ({
  embedText: jest.fn().mockResolvedValue(Array(1536).fill(0)),
}));

import type { SupabaseClient } from "@supabase/supabase-js";

function makeChain(resolveValue: unknown) {
  const c = {
    select: jest.fn(),
    eq: jest.fn(),
    upsert: jest.fn(),
    not: jest.fn(),
    order: jest.fn(),
    single: jest.fn(),
    update: jest.fn(),
  };
  c.select.mockReturnValue(c);
  c.eq.mockReturnValue(c);
  c.upsert.mockReturnValue(c);
  c.not.mockReturnValue(c);
  c.order.mockReturnValue(Promise.resolve(resolveValue));
  c.update.mockReturnValue(c);
  c.single.mockReturnValue(Promise.resolve(resolveValue));
  return c;
}

beforeEach(() => jest.clearAllMocks());

// ─── upsertResearcher ─────────────────────────────────────────────────────────

describe("upsertResearcher — user_id param", () => {
  it("includes user_id in the upsert row when userId is provided", async () => {
    const chain = makeChain({ data: { id: "row-1" }, error: null });
    mockServiceFrom.mockReturnValue(chain);

    const { upsertResearcher } = await import("@/lib/researcher-store");
    await upsertResearcher({ name: "Jane Smith" }, "jane-smith", "user-abc");

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-abc" }),
      expect.any(Object)
    );
  });

  it("omits user_id from the upsert row when userId is not provided", async () => {
    const chain = makeChain({ data: { id: "row-1" }, error: null });
    mockServiceFrom.mockReturnValue(chain);

    const { upsertResearcher } = await import("@/lib/researcher-store");
    await upsertResearcher({ name: "Jane Smith" }, "jane-smith");

    const upsertArg = chain.upsert.mock.calls[0][0];
    expect(upsertArg).not.toHaveProperty("user_id");
  });

  it("uses the provided client instead of service-role when passed", async () => {
    const customFrom = jest.fn();
    const chain = makeChain({ data: { id: "row-1" }, error: null });
    customFrom.mockReturnValue(chain);
    const customClient = { from: customFrom } as unknown as SupabaseClient;

    const { upsertResearcher } = await import("@/lib/researcher-store");
    await upsertResearcher({ name: "Jane Smith" }, "jane-smith", "user-xyz", customClient);

    expect(customFrom).toHaveBeenCalledWith("researchers");
    expect(mockServiceFrom).not.toHaveBeenCalled();
  });
});

// ─── listResearchersWithProfiles ──────────────────────────────────────────────

describe("listResearchersWithProfiles — client param", () => {
  it("uses service-role client when no client is passed", async () => {
    const chain = makeChain({ data: [], error: null });
    mockServiceFrom.mockReturnValue(chain);

    const { listResearchersWithProfiles } = await import("@/lib/researcher-store");
    await listResearchersWithProfiles("user-123");

    expect(mockServiceFrom).toHaveBeenCalledWith("researchers");
  });

  it("uses provided client when passed", async () => {
    const customFrom = jest.fn();
    const chain = makeChain({ data: [], error: null });
    customFrom.mockReturnValue(chain);
    const customClient = { from: customFrom } as unknown as SupabaseClient;

    const { listResearchersWithProfiles } = await import("@/lib/researcher-store");
    await listResearchersWithProfiles("user-123", customClient);

    expect(customFrom).toHaveBeenCalledWith("researchers");
    expect(mockServiceFrom).not.toHaveBeenCalled();
  });
});

// ─── getResearcherBySlug ──────────────────────────────────────────────────────

describe("getResearcherBySlug — client param", () => {
  it("uses service-role client when no client is passed", async () => {
    const chain = makeChain({
      data: { slug: "jane-smith", name: "Jane Smith", enriched_profile: {} },
      error: null,
    });
    mockServiceFrom.mockReturnValue(chain);

    const { getResearcherBySlug } = await import("@/lib/researcher-store");
    await getResearcherBySlug("jane-smith", "user-123");

    expect(mockServiceFrom).toHaveBeenCalledWith("researchers");
  });

  it("uses provided client when passed", async () => {
    const customFrom = jest.fn();
    const chain = makeChain({
      data: { slug: "jane-smith", name: "Jane Smith", enriched_profile: {} },
      error: null,
    });
    customFrom.mockReturnValue(chain);
    const customClient = { from: customFrom } as unknown as SupabaseClient;

    const { getResearcherBySlug } = await import("@/lib/researcher-store");
    await getResearcherBySlug("jane-smith", "user-123", customClient);

    expect(customFrom).toHaveBeenCalledWith("researchers");
    expect(mockServiceFrom).not.toHaveBeenCalled();
  });

  it("returns null when RLS blocks access (no data)", async () => {
    const chain = makeChain({ data: null, error: { message: "No rows found" } });
    mockServiceFrom.mockReturnValue(chain);

    const { getResearcherBySlug } = await import("@/lib/researcher-store");
    const result = await getResearcherBySlug("other-user-slug", "user-123");

    expect(result).toBeNull();
  });
});
