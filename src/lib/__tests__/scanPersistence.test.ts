// ─── Mock opportunity-store ───────────────────────────────────────────────────

const mockUpsertFunder = jest.fn();
const mockUpsertOpportunity = jest.fn();
const mockUpdateHarvest = jest.fn();

jest.mock("@/lib/opportunity-store", () => ({
  upsertFunderFromDiscovery: mockUpsertFunder,
  upsertOpportunityFromDiscovery: mockUpsertOpportunity,
  updateHarvestStatus: mockUpdateHarvest,
}));

import { persistDiscoveredResults } from "@/lib/scan-persistence";

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsertFunder.mockResolvedValue("funder-uuid-abc");
  mockUpsertOpportunity.mockResolvedValue(undefined);
  mockUpdateHarvest.mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("persistDiscoveredResults", () => {
  it("is a no-op when entries array is empty", async () => {
    await persistDiscoveredResults([], {});

    expect(mockUpsertFunder).not.toHaveBeenCalled();
    expect(mockUpsertOpportunity).not.toHaveBeenCalled();
    expect(mockUpdateHarvest).not.toHaveBeenCalled();
  });

  it("upserts each funder from the entries", async () => {
    const entries = [
      {
        funder_slug: "leverhulme",
        funder_name: "Leverhulme Trust",
        source_url: "https://www.leverhulme.ac.uk/funding",
        disciplines: ["arts", "humanities"],
        opportunities: [],
      },
      {
        funder_slug: "ahrc",
        funder_name: "AHRC",
        source_url: "https://www.ukri.org/councils/ahrc/",
        disciplines: ["humanities"],
        opportunities: [],
      },
    ];

    await persistDiscoveredResults(entries, { researcher: "jane-smith" });

    expect(mockUpsertFunder).toHaveBeenCalledTimes(2);
    expect(mockUpsertFunder).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "leverhulme",
        name: "Leverhulme Trust",
        source_url: "https://www.leverhulme.ac.uk/funding",
        disciplines: ["arts", "humanities"],
        discovered_by: "agentic_scan",
        discovery_context: { researcher: "jane-smith" },
      })
    );
  });

  it("upserts each opportunity under its funder", async () => {
    const entries = [
      {
        funder_slug: "wellcome",
        funder_name: "Wellcome Trust",
        source_url: "https://wellcome.org/grant-funding",
        disciplines: ["health"],
        opportunities: [
          {
            name: "Discovery Research",
            slug: "discovery-research",
            status: "open",
            deadline_raw: "2026-07-15",
            deadline_date: "2026-07-15",
            amount_raw: "Up to £3M",
            amount_min: null,
            amount_max: 3000000,
            url: "https://wellcome.org/discovery",
            funding_type: "research grant",
            description: "Supports discovery research.",
            eligibility: "UK HEI",
            scope: "Any health research",
          },
          {
            name: "Innovator Award",
            slug: "innovator-award",
            status: "open",
            deadline_raw: null,
            deadline_date: null,
            amount_raw: "Up to £500k",
            amount_min: null,
            amount_max: 500000,
            url: "https://wellcome.org/innovator",
            funding_type: "award",
            description: "For innovators.",
            eligibility: null,
            scope: null,
          },
        ],
      },
    ];

    await persistDiscoveredResults(entries, {});

    expect(mockUpsertOpportunity).toHaveBeenCalledTimes(2);
    expect(mockUpsertOpportunity).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "discovery-research" }),
      "funder-uuid-abc"
    );
    expect(mockUpsertOpportunity).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "innovator-award" }),
      "funder-uuid-abc"
    );
  });

  it("calls updateHarvestStatus with success after processing each funder", async () => {
    const entries = [
      {
        funder_slug: "esrc",
        funder_name: "ESRC",
        source_url: "https://www.ukri.org/councils/esrc/",
        disciplines: ["social-sciences"],
        opportunities: [],
      },
    ];

    await persistDiscoveredResults(entries, {});

    expect(mockUpdateHarvest).toHaveBeenCalledWith("esrc", "success");
  });

  it("calls updateHarvestStatus with failed if upsertFunder throws", async () => {
    mockUpsertFunder.mockRejectedValueOnce(new Error("DB unavailable"));

    const entries = [
      {
        funder_slug: "bbsrc",
        funder_name: "BBSRC",
        source_url: "https://www.ukri.org/councils/bbsrc/",
        disciplines: ["biosciences"],
        opportunities: [],
      },
    ];

    // Should not throw — errors per funder are caught and harvest status updated
    await persistDiscoveredResults(entries, {});

    expect(mockUpdateHarvest).toHaveBeenCalledWith("bbsrc", "failed");
  });
});
