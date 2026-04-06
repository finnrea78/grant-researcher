// ─── Mock opportunity-store ───────────────────────────────────────────────────

const mockGetFunderSourceUrls = jest.fn();
const mockGetExistingFunderSlugs = jest.fn();

jest.mock("@/lib/opportunity-store", () => ({
  getFunderSourceUrls: mockGetFunderSourceUrls,
  getExistingFunderSlugs: mockGetExistingFunderSlugs,
}));

import { buildScanDbContext } from "@/lib/scan-db-context";

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe("buildScanDbContext", () => {
  it("returns empty string when no funders are in the DB", async () => {
    mockGetFunderSourceUrls.mockResolvedValue({ toHarvest: [], fresh: [] });
    mockGetExistingFunderSlugs.mockResolvedValue([]);

    const result = await buildScanDbContext();

    expect(result).toBe("");
  });

  it("includes stale/new funder URLs in the harvest section", async () => {
    mockGetFunderSourceUrls.mockResolvedValue({
      toHarvest: [
        { slug: "wellcome", url: "https://wellcome.org/grant-funding/schemes" },
        { slug: "ahrc", url: "https://www.ukri.org/councils/ahrc/funding/" },
      ],
      fresh: [],
    });
    mockGetExistingFunderSlugs.mockResolvedValue(["wellcome", "ahrc"]);

    const result = await buildScanDbContext();

    expect(result).toContain("Database-sourced funders to harvest");
    expect(result).toContain("wellcome | https://wellcome.org/grant-funding/schemes");
    expect(result).toContain("ahrc | https://www.ukri.org/councils/ahrc/funding/");
  });

  it("puts recently harvested funders in the skip section, not the harvest section", async () => {
    mockGetFunderSourceUrls.mockResolvedValue({
      toHarvest: [{ slug: "ahrc", url: "https://www.ukri.org/councils/ahrc/funding/" }],
      fresh: [{ slug: "wellcome", url: "https://wellcome.org/grant-funding/schemes" }],
    });
    mockGetExistingFunderSlugs.mockResolvedValue(["wellcome", "ahrc"]);

    const result = await buildScanDbContext();

    // wellcome is fresh — should NOT appear in the harvest list
    expect(result).toContain("ahrc | https://www.ukri.org/councils/ahrc/funding/");
    expect(result).not.toContain("wellcome | https://wellcome.org");
    // wellcome slug should appear in the skip/dedup section
    expect(result).toContain("Recently harvested funders");
    expect(result).toContain("wellcome");
  });

  it("includes existing funder slugs in the output", async () => {
    mockGetFunderSourceUrls.mockResolvedValue({
      toHarvest: [{ slug: "esrc", url: "https://www.ukri.org/councils/esrc/" }],
      fresh: [],
    });
    mockGetExistingFunderSlugs.mockResolvedValue(["esrc", "ukri", "leverhulme"]);

    const result = await buildScanDbContext();

    expect(result).toContain("Existing funder slugs");
    expect(result).toContain("esrc");
    expect(result).toContain("ukri");
    expect(result).toContain("leverhulme");
  });

  it("returns empty string when DB query throws (graceful degradation)", async () => {
    mockGetFunderSourceUrls.mockRejectedValue(new Error("DB unavailable"));
    mockGetExistingFunderSlugs.mockResolvedValue([]);

    const result = await buildScanDbContext();

    expect(result).toBe("");
  });

  it("returns empty string when only slugs exist but no source URLs", async () => {
    mockGetFunderSourceUrls.mockResolvedValue({ toHarvest: [], fresh: [] });
    mockGetExistingFunderSlugs.mockResolvedValue(["wellcome", "ahrc"]);

    const result = await buildScanDbContext();

    expect(result).toContain("wellcome");
  });
});
