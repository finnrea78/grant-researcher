/**
 * Phase 2: Tests for funding-source-store module.
 * DB-backed funder markdown content, replacing data/funding-sources/*.md files.
 */

import {
  upsertFundingSource,
  listFundingSources,
  getFundingSource,
} from "@/lib/funding-source-store";

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
  const upsert: jest.Mock = jest.fn(() => Object.assign(resultPromise, { select }));
  return { select, upsert, eq, single, order };
}

const sampleSource = {
  slug: "ahrc-responsive-mode",
  name: "AHRC Responsive Mode",
  content_md: "## Overview\nAHRC Responsive Mode provides funding for...",
  source_url: "https://ahrc.ukri.org/funding/apply-for-funding/available-grants/",
  discovered_at: new Date().toISOString(),
  last_harvested: null,
};

describe("upsertFundingSource", () => {
  beforeEach(() => jest.clearAllMocks());

  it("upserts a funding source by slug", async () => {
    const insertedRow = { id: "uuid-123", ...sampleSource, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const chain = makeChain({ data: insertedRow, error: null });
    chain.upsert.mockReturnValue({ select: jest.fn(() => Object.assign(Promise.resolve({ data: insertedRow, error: null }), { single: jest.fn(() => Promise.resolve({ data: insertedRow, error: null })) })) });
    fromMock.mockReturnValue(chain);

    await upsertFundingSource(sampleSource);

    expect(fromMock).toHaveBeenCalledWith("funding_sources");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "ahrc-responsive-mode", name: "AHRC Responsive Mode" }),
      expect.objectContaining({ onConflict: "slug" })
    );
  });

  it("throws on DB error", async () => {
    const chain = makeChain({ data: null, error: { message: "Upsert failed" } });
    chain.upsert = jest.fn(() => Promise.resolve({ data: null, error: { message: "Upsert failed" } }));
    fromMock.mockReturnValue(chain);

    await expect(upsertFundingSource(sampleSource)).rejects.toThrow("Upsert failed");
  });
});

describe("listFundingSources", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns all funding sources ordered by name", async () => {
    const rows = [
      { id: "uuid-1", ...sampleSource, slug: "ahrc-responsive-mode", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: "uuid-2", ...sampleSource, slug: "wellcome-discovery", name: "Wellcome Discovery Award", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
    const chain = makeChain({ data: rows, error: null });
    fromMock.mockReturnValue(chain);

    const result = await listFundingSources();

    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe("ahrc-responsive-mode");
    expect(fromMock).toHaveBeenCalledWith("funding_sources");
  });

  it("returns empty array when no sources exist", async () => {
    const chain = makeChain({ data: [], error: null });
    fromMock.mockReturnValue(chain);

    const result = await listFundingSources();
    expect(result).toEqual([]);
  });

  it("throws on DB error", async () => {
    const chain = makeChain({ data: null, error: { message: "DB unavailable" } });
    fromMock.mockReturnValue(chain);

    await expect(listFundingSources()).rejects.toThrow("DB unavailable");
  });
});

describe("getFundingSource", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns a funding source by slug", async () => {
    const row = { id: "uuid-1", ...sampleSource, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const chain = makeChain({ data: row, error: null });
    fromMock.mockReturnValue(chain);

    const result = await getFundingSource("ahrc-responsive-mode");

    expect(result).not.toBeNull();
    expect(result!.slug).toBe("ahrc-responsive-mode");
    expect(result!.content_md).toContain("AHRC Responsive Mode");
    expect(chain.eq).toHaveBeenCalledWith("slug", "ahrc-responsive-mode");
  });

  it("returns null when source does not exist", async () => {
    const chain = makeChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    const result = await getFundingSource("nonexistent-slug");
    expect(result).toBeNull();
  });

  it("throws on DB error", async () => {
    const chain = makeChain({ data: null, error: { message: "Not found" } });
    fromMock.mockReturnValue(chain);

    await expect(getFundingSource("ahrc-responsive-mode")).rejects.toThrow("Not found");
  });
});
