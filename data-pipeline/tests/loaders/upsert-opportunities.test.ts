// data-pipeline/tests/loaders/upsert-opportunities.test.ts

// ─── Mock @grant-researcher/db ────────────────────────────────────────────────
const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
const mockSingle = jest.fn();
const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
const mockUpsert = jest.fn().mockReturnValue({ select: mockSelect });
const mockFrom = jest.fn().mockReturnValue({ upsert: mockUpsert, update: mockUpdate });

jest.mock("@grant-researcher/db", () => ({
  supabase: { from: mockFrom },
}));

// ─── Mock embedder ────────────────────────────────────────────────────────────
const mockBuildText = jest.fn().mockReturnValue("Grant text");
const mockEmbedText = jest.fn().mockResolvedValue(Array(1536).fill(0.1));

jest.mock("../../src/lib/embedder", () => ({
  buildOpportunityText: mockBuildText,
  embedText: mockEmbedText,
}));

import { upsertOpportunities } from "../../src/loaders/upsert-opportunities";
import type { NormalisedOpportunity } from "../../src/types";

const OPP: NormalisedOpportunity = {
  funder_slug: "ahrc",
  name: "Research Fellowship",
  slug: "research-fellowship",
  status: "open",
  deadline_raw: null,
  deadline_date: null,
  amount_raw: null,
  amount_min: null,
  amount_max: null,
  amount_currency: "GBP",
  url: null,
  funding_type: "fellowship",
  description: "A fellowship for researchers",
  eligibility: "UK HEI only",
  scope: "Arts and humanities",
  source: "ukri_funding_finder",
  source_metadata: {},
};

const FUNDER_MAP = new Map([["ahrc", { id: "funder-uuid", name: "AHRC" }]]);

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReturnValue({ upsert: mockUpsert, update: mockUpdate });
  mockUpsert.mockReturnValue({ select: mockSelect });
  mockUpdate.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
});

describe("upsertOpportunities with embedding", () => {
  it("calls embedText and stores embedding for a new opportunity (no existing embedding)", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "opp-uuid", created_at: "2026-01-01", updated_at: "2026-01-01", embedding: null },
      error: null,
    });

    await upsertOpportunities([OPP], FUNDER_MAP);

    expect(mockBuildText).toHaveBeenCalledWith(expect.objectContaining({ name: "Research Fellowship" }));
    expect(mockEmbedText).toHaveBeenCalledWith("Grant text");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("skips embedText if opportunity already has an embedding", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "opp-uuid", created_at: "2026-01-01", updated_at: "2026-01-01", embedding: Array(1536).fill(0.5) },
      error: null,
    });

    await upsertOpportunities([OPP], FUNDER_MAP);

    expect(mockEmbedText).not.toHaveBeenCalled();
  });

  it("skips embedding if upsert fails", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } });

    await upsertOpportunities([OPP], FUNDER_MAP);

    expect(mockEmbedText).not.toHaveBeenCalled();
  });

  it("skips funder not in funderMap without calling embedder", async () => {
    await upsertOpportunities([OPP], new Map());
    expect(mockEmbedText).not.toHaveBeenCalled();
  });
});
