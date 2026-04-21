// ─── Mock opportunity-store ───────────────────────────────────────────────────

const mockGetStaleFunders = jest.fn();
const mockGetExistingFunderSlugs = jest.fn();

jest.mock("@/lib/opportunity-store", () => ({
  getStaleFunders: mockGetStaleFunders,
  getExistingFunderSlugs: mockGetExistingFunderSlugs,
}));

import { buildScanDbContext, getScanUrlList } from "@/lib/scan-db-context";

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe("buildScanDbContext", () => {
  it("returns empty string when no funders are in the DB", async () => {
    mockGetExistingFunderSlugs.mockResolvedValue([]);

    const result = await buildScanDbContext();

    expect(result).toBe("");
  });

  it("includes existing funder slugs for dedup", async () => {
    mockGetExistingFunderSlugs.mockResolvedValue(["wellcome", "ahrc", "leverhulme"]);

    const result = await buildScanDbContext();

    expect(result).toContain("Existing funder slugs");
    expect(result).toContain("wellcome");
    expect(result).toContain("ahrc");
    expect(result).toContain("leverhulme");
  });

  it("returns empty string when DB query throws (graceful degradation)", async () => {
    mockGetExistingFunderSlugs.mockRejectedValue(new Error("DB unavailable"));

    const result = await buildScanDbContext();

    expect(result).toBe("");
  });
});

describe("getScanUrlList", () => {
  it("returns stale funders as ScanPlanEntry[]", async () => {
    mockGetStaleFunders.mockResolvedValue([
      { slug: "wellcome", url: "https://wellcome.org/grant-funding/schemes" },
      { slug: "ahrc", url: "https://www.ukri.org/councils/ahrc/funding/" },
    ]);

    const result = await getScanUrlList();

    expect(result).toEqual([
      { slug: "wellcome", url: "https://wellcome.org/grant-funding/schemes" },
      { slug: "ahrc", url: "https://www.ukri.org/councils/ahrc/funding/" },
    ]);
  });

  it("returns empty array when no funders are stale", async () => {
    mockGetStaleFunders.mockResolvedValue([]);

    const result = await getScanUrlList();

    expect(result).toEqual([]);
  });
});
