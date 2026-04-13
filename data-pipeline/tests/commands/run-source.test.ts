// data-pipeline/tests/commands/run-source.test.ts

// ─── Mock @grant-researcher/db ────────────────────────────────────────────────
const mockFrom = jest.fn();
jest.mock("@grant-researcher/db", () => ({
  supabase: { from: mockFrom },
}));

// ─── Mock loaders ─────────────────────────────────────────────────────────────
const mockStartRun = jest.fn().mockResolvedValue("run-123");
const mockCompleteRun = jest.fn().mockResolvedValue(undefined);
jest.mock("../../src/loaders/log-run", () => ({
  startRun: mockStartRun,
  completeRun: mockCompleteRun,
}));

const mockUpsertFunder = jest.fn().mockResolvedValue("funder-id-1");
jest.mock("../../src/loaders/upsert-funder", () => ({
  upsertFunder: mockUpsertFunder,
}));

const mockUpsertOpportunities = jest.fn().mockResolvedValue({ created: 2, updated: 1, skipped: 0 });
jest.mock("../../src/loaders/upsert-opportunities", () => ({
  upsertOpportunities: mockUpsertOpportunities,
}));

import { runOpportunitySource } from "../../src/commands/run-source";
import type { NormalisedOpportunity } from "../../src/types";

const fakeOpportunity: NormalisedOpportunity = {
  funder_slug: "wellcome-trust",
  funder_name: "Wellcome Trust",
  name: "Test Grant",
  slug: "test-grant",
  status: "open",
  deadline_raw: null,
  deadline_date: null,
  amount_raw: null,
  amount_min: null,
  amount_max: null,
  amount_currency: "GBP",
  url: null,
  funding_type: null,
  description: "A test grant",
  eligibility: null,
  scope: null,
  source: "wellcome",
  source_metadata: {},
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStartRun.mockResolvedValue("run-123");
  mockUpsertFunder.mockResolvedValue("funder-id-1");
  mockUpsertOpportunities.mockResolvedValue({ created: 2, updated: 1, skipped: 0 });
});

describe("runOpportunitySource", () => {
  it("runs the full pipeline on success", async () => {
    const result = await runOpportunitySource({
      displayName: "Test Source",
      source: "wellcome",
      funderSlug: "wellcome-trust",
      fetch: async () => [fakeOpportunity],
    });

    expect(result.status).toBe("success");
    expect(result.counters).toEqual({ created: 2, updated: 1, skipped: 0 });
    expect(mockStartRun).toHaveBeenCalledWith("wellcome", "wellcome-trust");
    expect(mockUpsertOpportunities).toHaveBeenCalledTimes(1);
    expect(mockCompleteRun).toHaveBeenCalledWith("run-123", "success", { created: 2, updated: 1, skipped: 0 });
  });

  it("handles fetch failure without rethrowing", async () => {
    const result = await runOpportunitySource({
      displayName: "Failing Source",
      source: "wellcome",
      funderSlug: "wellcome-trust",
      fetch: async () => { throw new Error("Network timeout"); },
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("Network timeout");
    expect(result.counters).toEqual({ created: 0, updated: 0, skipped: 0 });
    expect(mockCompleteRun).toHaveBeenCalledWith(
      "run-123", "failed", { created: 0, updated: 0, skipped: 0 }, "Network timeout"
    );
  });

  it("passes undefined funderSlug when not provided", async () => {
    await runOpportunitySource({
      displayName: "No Funder",
      source: "find_a_grant",
      fetch: async () => [fakeOpportunity],
    });

    expect(mockStartRun).toHaveBeenCalledWith("find_a_grant", undefined);
  });
});
