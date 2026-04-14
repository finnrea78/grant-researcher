// data-pipeline/tests/commands/embed-backfill.test.ts

// ─── Mock @grant-researcher/db ────────────────────────────────────────────────
const mockLimit = jest.fn();
const mockIs = jest.fn().mockReturnValue({ limit: mockLimit });
const mockEq = jest.fn().mockReturnValue({ data: null, error: null });
const mockUpdateChain = { eq: mockEq };
const mockUpdate = jest.fn().mockReturnValue(mockUpdateChain);
const mockSelect = jest.fn().mockReturnValue({ is: mockIs });
const mockFrom = jest.fn();

jest.mock("@grant-researcher/db", () => ({
  supabase: { from: mockFrom },
}));

// ─── Mock embedder ────────────────────────────────────────────────────────────
const mockBuildText = jest.fn().mockReturnValue("opportunity text");
const mockEmbedText = jest.fn().mockResolvedValue(Array(1536).fill(0.2));

jest.mock("../../src/lib/embedder", () => ({
  buildOpportunityText: mockBuildText,
  embedText: mockEmbedText,
}));

import { embedBackfill } from "../../src/commands/embed-backfill";

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
  mockIs.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue({ data: [], error: null });
  mockEq.mockResolvedValue({ error: null });
});

describe("embedBackfill", () => {
  it("queries only opportunities WHERE embedding IS NULL", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await embedBackfill({ batchSize: 100 });

    expect(mockFrom).toHaveBeenCalledWith("opportunities");
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining("id"));
    expect(mockIs).toHaveBeenCalledWith("embedding", null);
  });

  it("returns count of embedded and skipped (already had embedding)", async () => {
    // Simulate 2 opportunities without embeddings
    mockLimit.mockResolvedValueOnce({
      data: [
        { id: "opp-1", name: "Grant A", description: "Desc", scope: null, eligibility: null },
        { id: "opp-2", name: "Grant B", description: "Desc", scope: null, eligibility: null },
      ],
      error: null,
    });
    // Second batch empty (signals end)
    mockLimit.mockResolvedValue({ data: [], error: null });

    const { embedded, skipped } = await embedBackfill({ batchSize: 100 });

    expect(embedded).toBe(2);
    expect(skipped).toBe(0);
  });

  it("processes in batches of batchSize", async () => {
    const batch1 = Array.from({ length: 2 }, (_, i) => ({
      id: `opp-${i}`, name: `Grant ${i}`, description: null, scope: null, eligibility: null,
    }));
    mockLimit
      .mockResolvedValueOnce({ data: batch1, error: null })
      .mockResolvedValue({ data: [], error: null });

    await embedBackfill({ batchSize: 2 });

    // limit should have been called with batchSize
    expect(mockLimit).toHaveBeenCalledWith(2);
  });

  it("throws on Supabase query error", async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: "DB error" } });
    await expect(embedBackfill({ batchSize: 100 })).rejects.toThrow("DB error");
  });
});
