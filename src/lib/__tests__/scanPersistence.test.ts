import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ─── Mock opportunity-store ───────────────────────────────────────────────────

const mockUpsertFunder = jest.fn();
const mockUpsertOpportunity = jest.fn();
const mockUpdateHarvest = jest.fn();

jest.mock("@/lib/opportunity-store", () => ({
  upsertFunderFromDiscovery: mockUpsertFunder,
  upsertOpportunityFromDiscovery: mockUpsertOpportunity,
  updateHarvestStatus: mockUpdateHarvest,
}));

import { persistDiscoveredManifest } from "@/lib/scan-persistence";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  jest.clearAllMocks();
  tmpDir = mkdtempSync(join(tmpdir(), "grant-scan-test-"));
  mockUpsertFunder.mockResolvedValue("funder-uuid-abc");
  mockUpsertOpportunity.mockResolvedValue(undefined);
  mockUpdateHarvest.mockResolvedValue(undefined);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("persistDiscoveredManifest", () => {
  it("is a no-op when manifest file does not exist", async () => {
    const nonExistentPath = join(tmpDir, "_discovered.json");
    await persistDiscoveredManifest(nonExistentPath, {});

    expect(mockUpsertFunder).not.toHaveBeenCalled();
    expect(mockUpsertOpportunity).not.toHaveBeenCalled();
    expect(mockUpdateHarvest).not.toHaveBeenCalled();
  });

  it("upserts each funder from the manifest", async () => {
    const manifest = [
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
    writeFileSync(join(tmpDir, "_discovered.json"), JSON.stringify(manifest));

    await persistDiscoveredManifest(join(tmpDir, "_discovered.json"), {
      researcher: "jane-smith",
    });

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
    const manifest = [
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
    writeFileSync(join(tmpDir, "_discovered.json"), JSON.stringify(manifest));

    await persistDiscoveredManifest(join(tmpDir, "_discovered.json"), {});

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
    const manifest = [
      {
        funder_slug: "esrc",
        funder_name: "ESRC",
        source_url: "https://www.ukri.org/councils/esrc/",
        disciplines: ["social-sciences"],
        opportunities: [],
      },
    ];
    writeFileSync(join(tmpDir, "_discovered.json"), JSON.stringify(manifest));

    await persistDiscoveredManifest(join(tmpDir, "_discovered.json"), {});

    expect(mockUpdateHarvest).toHaveBeenCalledWith("esrc", "success");
  });

  it("calls updateHarvestStatus with failed if upsertFunder throws", async () => {
    mockUpsertFunder.mockRejectedValueOnce(new Error("DB unavailable"));

    const manifest = [
      {
        funder_slug: "bbsrc",
        funder_name: "BBSRC",
        source_url: "https://www.ukri.org/councils/bbsrc/",
        disciplines: ["biosciences"],
        opportunities: [],
      },
    ];
    writeFileSync(join(tmpDir, "_discovered.json"), JSON.stringify(manifest));

    // Should not throw — errors per funder are caught and harvest status updated
    await persistDiscoveredManifest(join(tmpDir, "_discovered.json"), {});

    expect(mockUpdateHarvest).toHaveBeenCalledWith("bbsrc", "failed");
  });

  it("handles malformed JSON gracefully without throwing", async () => {
    writeFileSync(join(tmpDir, "_discovered.json"), "not valid json {{");

    await expect(
      persistDiscoveredManifest(join(tmpDir, "_discovered.json"), {})
    ).resolves.not.toThrow();

    expect(mockUpsertFunder).not.toHaveBeenCalled();
  });
});
