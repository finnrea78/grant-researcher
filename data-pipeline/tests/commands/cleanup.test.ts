// data-pipeline/tests/commands/cleanup.test.ts

// ─── Mock @grant-researcher/db ────────────────────────────────────────────────
const mockSelect = jest.fn();
const mockNeq = jest.fn().mockReturnValue({ select: mockSelect });
const mockLt = jest.fn().mockReturnValue({ neq: mockNeq });
const mockUpdate = jest.fn().mockReturnValue({ lt: mockLt });
const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate });

jest.mock("@grant-researcher/db", () => ({
  supabase: { from: mockFrom },
}));

// ─── Mock log-run ─────────────────────────────────────────────────────────────
const mockStartRun = jest.fn().mockResolvedValue("cleanup-run-1");
const mockCompleteRun = jest.fn().mockResolvedValue(undefined);
jest.mock("../../src/loaders/log-run", () => ({
  startRun: mockStartRun,
  completeRun: mockCompleteRun,
}));

// ─── Mock embed-backfill ──────────────────────────────────────────────────────
const mockEmbedBackfill = jest.fn().mockResolvedValue({ embedded: 3, skipped: 0 });
jest.mock("../../src/commands/embed-backfill", () => ({
  embedBackfill: mockEmbedBackfill,
}));

import { runCleanup } from "../../src/commands/cleanup";

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReturnValue({ update: mockUpdate });
  mockSelect.mockResolvedValue({ data: [{ id: "1" }, { id: "2" }], error: null });
  mockStartRun.mockResolvedValue("cleanup-run-1");
  mockEmbedBackfill.mockResolvedValue({ embedded: 3, skipped: 0 });
});

describe("runCleanup", () => {
  it("closes expired opportunities and backfills embeddings", async () => {
    const result = await runCleanup();

    expect(result.closed).toBe(2);
    expect(result.embedded).toBe(3);

    // Verify Supabase chain
    expect(mockFrom).toHaveBeenCalledWith("opportunities");
    expect(mockUpdate).toHaveBeenCalledWith({ status: "closed" });
    expect(mockLt).toHaveBeenCalledWith("deadline_date", expect.any(String));
    expect(mockNeq).toHaveBeenCalledWith("status", "closed");

    // Verify embedBackfill called
    expect(mockEmbedBackfill).toHaveBeenCalledTimes(1);

    // Verify run logging
    expect(mockStartRun).toHaveBeenCalledWith("cleanup");
    expect(mockCompleteRun).toHaveBeenCalledWith("cleanup-run-1", "success", { created: 0, updated: 2, skipped: 0 });
  });

  it("handles Supabase close error gracefully", async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: "DB error" } });

    const result = await runCleanup();

    expect(result.closed).toBe(0);
    expect(result.embedded).toBe(0);
    expect(mockCompleteRun).toHaveBeenCalledWith(
      "cleanup-run-1", "failed", { created: 0, updated: 0, skipped: 0 }, "DB error"
    );
    expect(mockEmbedBackfill).not.toHaveBeenCalled();
  });
});
