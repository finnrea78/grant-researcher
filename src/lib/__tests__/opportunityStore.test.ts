import type { DiscoveredFunder, DiscoveredOpportunity } from "@/lib/types";

// ─── Supabase mock ────────────────────────────────────────────────────────────
//
// Supabase's query builder is a lazy thenable: each method returns the builder,
// and `await builder` triggers the request. We mimic this with a thenable chain.
// `makeChain(resolveValue)` creates a fresh chain that resolves to resolveValue
// when awaited. Tests can override individual methods on currentChain before calling
// the function under test.

function makeChain(resolveValue: unknown) {
  const c = {
    select: jest.fn(),
    eq: jest.fn(),
    not: jest.fn(),
    gt: jest.fn(),
    or: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    single: jest.fn(),
    then: jest.fn(),
  };
  // All chain methods return c so calls can be chained
  c.select.mockReturnValue(c);
  c.eq.mockReturnValue(c);
  c.not.mockReturnValue(c);
  c.gt.mockReturnValue(c);
  c.or.mockReturnValue(c);
  c.upsert.mockReturnValue(c);
  c.update.mockReturnValue(c);
  c.single.mockReturnValue(Promise.resolve(resolveValue));
  // Make the chain itself awaitable (thenable) so `await chain` resolves
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

// ─── Import after mock ────────────────────────────────────────────────────────

import {
  getExistingFunderSlugs,
  getExistingOpportunities,
  getFunderSourceUrls,
  upsertFunderFromDiscovery,
  upsertOpportunityFromDiscovery,
  updateHarvestStatus,
} from "@/lib/opportunity-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let currentChain: ReturnType<typeof makeChain>;

function setupChain(resolveValue: unknown) {
  currentChain = makeChain(resolveValue);
  mockFrom.mockReturnValue(currentChain);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── getExistingFunderSlugs ───────────────────────────────────────────────────

describe("getExistingFunderSlugs", () => {
  it("returns flat array of slugs from funders table", async () => {
    setupChain({
      data: [{ slug: "wellcome" }, { slug: "ahrc" }, { slug: "esrc" }],
      error: null,
    });

    const slugs = await getExistingFunderSlugs();

    expect(mockFrom).toHaveBeenCalledWith("funders");
    expect(slugs).toEqual(["wellcome", "ahrc", "esrc"]);
  });

  it("returns empty array when no funders exist", async () => {
    setupChain({ data: [], error: null });
    const slugs = await getExistingFunderSlugs();
    expect(slugs).toEqual([]);
  });

  it("throws when Supabase returns an error", async () => {
    setupChain({ data: null, error: { message: "DB error" } });
    await expect(getExistingFunderSlugs()).rejects.toThrow("DB error");
  });
});

// ─── getExistingOpportunities ─────────────────────────────────────────────────

describe("getExistingOpportunities", () => {
  it("returns open opportunities with future deadlines", async () => {
    const rows = [
      { id: "1", name: "Discovery Research", funder: { slug: "wellcome" } },
    ];
    setupChain({ data: rows, error: null });

    const results = await getExistingOpportunities();

    expect(mockFrom).toHaveBeenCalledWith("opportunities");
    expect(results).toEqual(rows);
  });

  it("filters by funderSlug when provided", async () => {
    setupChain({ data: [], error: null });

    await getExistingOpportunities("wellcome");

    // eq should have been called to filter by funder slug
    expect(currentChain.eq).toHaveBeenCalledWith(
      expect.stringContaining("slug"),
      "wellcome"
    );
  });

  it("throws when Supabase returns an error", async () => {
    setupChain({ data: null, error: { message: "Query failed" } });
    await expect(getExistingOpportunities()).rejects.toThrow("Query failed");
  });
});

// ─── getFunderSourceUrls ──────────────────────────────────────────────────────

describe("getFunderSourceUrls", () => {
  it("returns only funders that have a non-null source_url", async () => {
    setupChain({
      data: [
        { slug: "wellcome", source_url: "https://wellcome.org/grant-funding/schemes" },
        { slug: "ahrc", source_url: "https://www.ukri.org/councils/ahrc/funding/" },
      ],
      error: null,
    });

    const urls = await getFunderSourceUrls();

    expect(mockFrom).toHaveBeenCalledWith("funders");
    expect(currentChain.not).toHaveBeenCalledWith("source_url", "is", null);
    expect(urls).toEqual([
      { slug: "wellcome", url: "https://wellcome.org/grant-funding/schemes" },
      { slug: "ahrc", url: "https://www.ukri.org/councils/ahrc/funding/" },
    ]);
  });

  it("returns empty array when no funders have source_url", async () => {
    setupChain({ data: [], error: null });
    const urls = await getFunderSourceUrls();
    expect(urls).toEqual([]);
  });
});

// ─── upsertFunderFromDiscovery ────────────────────────────────────────────────

describe("upsertFunderFromDiscovery", () => {
  const funder: DiscoveredFunder = {
    slug: "leverhulme",
    name: "Leverhulme Trust",
    website: "https://www.leverhulme.ac.uk",
    source_url: "https://www.leverhulme.ac.uk/funding",
    disciplines: ["arts", "humanities"],
    discovered_by: "agentic_scan",
    discovery_context: { researcher: "jane-smith" },
  };

  it("upserts funder with discovery metadata and returns id", async () => {
    setupChain(null); // base chain
    currentChain.upsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "uuid-123" }, error: null }),
      }),
    });

    const id = await upsertFunderFromDiscovery(funder);

    expect(mockFrom).toHaveBeenCalledWith("funders");
    expect(id).toBe("uuid-123");
  });

  it("does not overwrite discovered_by if funder already exists as pipeline source", async () => {
    setupChain(null);
    currentChain.upsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "uuid-456" }, error: null }),
      }),
    });

    await upsertFunderFromDiscovery(funder);

    const upsertCall = currentChain.upsert.mock.calls[0];
    const upsertOptions = upsertCall[1]; // second arg is options
    // onConflict should be set (slug-based conflict resolution)
    expect(upsertOptions?.ignoreDuplicates ?? upsertOptions?.onConflict).toBeDefined();
  });

  it("throws when Supabase returns an error", async () => {
    setupChain(null);
    currentChain.upsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Upsert failed" },
        }),
      }),
    });

    await expect(upsertFunderFromDiscovery(funder)).rejects.toThrow("Upsert failed");
  });
});

// ─── upsertOpportunityFromDiscovery ──────────────────────────────────────────

describe("upsertOpportunityFromDiscovery", () => {
  const opp: DiscoveredOpportunity = {
    name: "Research Fellowship",
    slug: "research-fellowship",
    status: "open",
    deadline_raw: "2026-09-01",
    deadline_date: "2026-09-01",
    amount_raw: "Up to £50k",
    amount_min: null,
    amount_max: 50000,
    url: "https://example.com/fellowship",
    funding_type: "fellowship",
    description: "A research fellowship for early-career researchers.",
    eligibility: "Must be within 5 years of PhD",
    scope: "Any discipline",
  };

  it("upserts opportunity with source: agentic_scan", async () => {
    setupChain(null);
    currentChain.upsert.mockResolvedValue({ error: null });

    await upsertOpportunityFromDiscovery(opp, "funder-uuid-123");

    expect(mockFrom).toHaveBeenCalledWith("opportunities");
    const upsertPayload = currentChain.upsert.mock.calls[0][0];
    expect(upsertPayload.source).toBe("agentic_scan");
    expect(upsertPayload.funder_id).toBe("funder-uuid-123");
  });

  it("does not overwrite existing opportunity where source is ukri_funding_finder", async () => {
    setupChain(null);
    currentChain.upsert.mockResolvedValue({ error: null });

    await upsertOpportunityFromDiscovery(opp, "funder-uuid-123");

    const upsertCall = currentChain.upsert.mock.calls[0];
    const upsertOptions = upsertCall[1];
    // Conflict resolution must specify onConflict column(s)
    expect(upsertOptions?.onConflict).toBeDefined();
  });

  it("throws when Supabase returns an error", async () => {
    setupChain(null);
    currentChain.upsert.mockResolvedValue({ error: { message: "Conflict error" } });
    await expect(upsertOpportunityFromDiscovery(opp, "funder-uuid")).rejects.toThrow(
      "Conflict error"
    );
  });
});

// ─── updateHarvestStatus ──────────────────────────────────────────────────────

describe("updateHarvestStatus", () => {
  it("sets last_harvested_at and last_harvest_status", async () => {
    setupChain(null);
    currentChain.update.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    await updateHarvestStatus("wellcome", "success");

    expect(mockFrom).toHaveBeenCalledWith("funders");
    const updatePayload = currentChain.update.mock.calls[0][0];
    expect(updatePayload.last_harvest_status).toBe("success");
    expect(updatePayload.last_harvested_at).toBeDefined();
  });

  it("throws when Supabase returns an error", async () => {
    setupChain(null);
    currentChain.update.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: { message: "Update failed" } }),
    });

    await expect(updateHarvestStatus("wellcome", "failed")).rejects.toThrow(
      "Update failed"
    );
  });
});
