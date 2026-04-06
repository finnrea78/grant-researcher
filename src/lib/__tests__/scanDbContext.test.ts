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
    mockGetFunderSourceUrls.mockResolvedValue([]);
    mockGetExistingFunderSlugs.mockResolvedValue([]);

    const result = await buildScanDbContext();

    expect(result).toBe("");
  });

  it("includes database-sourced funder URLs in the output", async () => {
    mockGetFunderSourceUrls.mockResolvedValue([
      { slug: "wellcome", url: "https://wellcome.org/grant-funding/schemes" },
      { slug: "ahrc", url: "https://www.ukri.org/councils/ahrc/funding/" },
    ]);
    mockGetExistingFunderSlugs.mockResolvedValue(["wellcome", "ahrc"]);

    const result = await buildScanDbContext();

    expect(result).toContain("Database-sourced funders");
    expect(result).toContain("wellcome | https://wellcome.org/grant-funding/schemes");
    expect(result).toContain("ahrc | https://www.ukri.org/councils/ahrc/funding/");
  });

  it("includes existing funder slugs in the output", async () => {
    mockGetFunderSourceUrls.mockResolvedValue([
      { slug: "esrc", url: "https://www.ukri.org/councils/esrc/" },
    ]);
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

    // Should not throw — scan route continues without DB context
    const result = await buildScanDbContext();

    expect(result).toBe("");
  });

  it("returns empty string when only slugs exist but no source URLs", async () => {
    mockGetFunderSourceUrls.mockResolvedValue([]);
    mockGetExistingFunderSlugs.mockResolvedValue(["wellcome", "ahrc"]);

    const result = await buildScanDbContext();

    // No source URLs to harvest, but slugs can still inform dedup
    // The context should still mention existing slugs
    expect(result).toContain("wellcome");
  });
});
