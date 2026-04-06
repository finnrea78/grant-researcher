import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ─── Mock @grant-researcher/db ────────────────────────────────────────────────

const mockSingle = jest.fn();
const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
const mockUpsert = jest.fn().mockReturnValue({ select: mockSelect });
const mockFrom = jest.fn().mockReturnValue({ upsert: mockUpsert });

jest.mock("@grant-researcher/db", () => ({
  supabase: { from: mockFrom },
}));

import {
  seedSourcesFromUrlList,
  upsertDiscoveredSource,
} from "../../src/loaders/upsert-discovered-source";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReturnValue({ upsert: mockUpsert });
  mockUpsert.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ single: mockSingle });
  mockSingle.mockResolvedValue({ data: { id: "funder-uuid" }, error: null });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "seed-sources-test-"));
});

// ─── upsertDiscoveredSource ───────────────────────────────────────────────────

describe("upsertDiscoveredSource", () => {
  it("upserts funder with source_url and discovered_by", async () => {
    await upsertDiscoveredSource({
      slug: "ahrc",
      source_url: "https://www.ukri.org/councils/ahrc/funding/",
      discovered_by: "manual",
    });

    expect(mockFrom).toHaveBeenCalledWith("funders");
    const payload = mockUpsert.mock.calls[0][0];
    expect(payload.slug).toBe("ahrc");
    expect(payload.source_url).toBe("https://www.ukri.org/councils/ahrc/funding/");
    expect(payload.discovered_by).toBe("manual");
  });

  it("throws when Supabase returns an error", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "DB error" } });

    await expect(
      upsertDiscoveredSource({
        slug: "ahrc",
        source_url: "https://example.com",
        discovered_by: "manual",
      })
    ).rejects.toThrow("DB error");
  });
});

// ─── seedSourcesFromUrlList ───────────────────────────────────────────────────

describe("seedSourcesFromUrlList", () => {
  it("parses each line and upserts as a manual funder", async () => {
    const urlsMd = `# Funding Sources URL List

Format: \`funder-slug | URL\`

---

ahrc | https://www.ukri.org/councils/ahrc/funding/
ba | https://www.thebritishacademy.ac.uk/funding/
leverhulme | https://www.leverhulme.ac.uk/funding
`;
    writeFileSync(join(tmpDir, "_urls.md"), urlsMd);

    await seedSourcesFromUrlList(join(tmpDir, "_urls.md"));

    // 3 valid lines → 3 upsert calls
    expect(mockUpsert).toHaveBeenCalledTimes(3);

    const payloads = mockUpsert.mock.calls.map((c) => c[0] as { slug: string; discovered_by: string });
    const slugs = payloads.map((p) => p.slug);
    expect(slugs).toContain("ahrc");
    expect(slugs).toContain("ba");
    expect(slugs).toContain("leverhulme");

    // All should be discovered_by: manual
    for (const p of payloads) {
      expect(p.discovered_by).toBe("manual");
    }
  });

  it("skips blank lines, comment lines, and header lines", async () => {
    const urlsMd = `# Heading

Some description text.

Format: \`funder-slug | URL\`

---

esrc | https://www.ukri.org/councils/esrc/funding/

`;
    writeFileSync(join(tmpDir, "_urls.md"), urlsMd);

    await seedSourcesFromUrlList(join(tmpDir, "_urls.md"));

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const payload = mockUpsert.mock.calls[0][0] as { slug: string };
    expect(payload.slug).toBe("esrc");
  });

  it("skips lines that do not match the slug | URL pattern", async () => {
    const urlsMd = `not-valid-format
also invalid
ahrc | https://www.ukri.org/councils/ahrc/funding/
`;
    writeFileSync(join(tmpDir, "_urls.md"), urlsMd);

    await seedSourcesFromUrlList(join(tmpDir, "_urls.md"));

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("returns a count of successfully seeded sources", async () => {
    const urlsMd = `ahrc | https://www.ukri.org/councils/ahrc/
bbsrc | https://www.ukri.org/councils/bbsrc/
`;
    writeFileSync(join(tmpDir, "_urls.md"), urlsMd);

    const count = await seedSourcesFromUrlList(join(tmpDir, "_urls.md"));

    expect(count).toBe(2);
  });

  it("throws when the file does not exist", async () => {
    await expect(
      seedSourcesFromUrlList(join(tmpDir, "nonexistent.md"))
    ).rejects.toThrow();
  });
});
