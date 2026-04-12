/**
 * Phase 1: Tests for new researcher-store functions.
 * All these functions deal with the existing (but unused) pipeline_state,
 * publications_md, match_results_md, and scholar_candidate columns.
 */

import {
  updatePipelineState,
  getPipelineState,
  updateScholarCandidate,
  updatePublicationsMd,
  updateMatchResultsMd,
  getResearcherFull,
} from "@/lib/researcher-store";

// Mock the Supabase client
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      update: mockUpdate,
      select: mockSelect,
    })),
  },
}));

// Build a fluent chain mock helper.
// Each terminal method (eq, single) returns a Promise resolving to result,
// so both `await .eq(...)` and `await .eq(...).single()` work correctly.
function makeChain(result: { data?: unknown; error?: unknown }) {
  const resultPromise = Promise.resolve(result);
  const single: jest.Mock = jest.fn(() => resultPromise);
  const eq: jest.Mock = jest.fn(() => Object.assign(resultPromise, { eq, single }));
  const select: jest.Mock = jest.fn(() => Object.assign(resultPromise, { eq, single }));
  const update: jest.Mock = jest.fn(() => Object.assign(resultPromise, { eq, single }));
  return { select, update, eq, single };
}

// Get typed reference to mock
import { supabase } from "@/lib/supabase";
const fromMock = supabase.from as jest.Mock;

describe("updatePipelineState", () => {
  beforeEach(() => jest.clearAllMocks());

  it("merges patch into pipeline_state using jsonb || operator", async () => {
    const chain = makeChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    await updatePipelineState("jane-smith", { profile: true });

    expect(fromMock).toHaveBeenCalledWith("researchers");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline_state: expect.any(Object),
      })
    );
    expect(chain.eq).toHaveBeenCalledWith("slug", "jane-smith");
  });

  it("throws when Supabase returns an error", async () => {
    const chain = makeChain({ data: null, error: { message: "DB error" } });
    fromMock.mockReturnValue(chain);

    await expect(updatePipelineState("jane-smith", { profile: true })).rejects.toThrow(
      "DB error"
    );
  });
});

describe("getPipelineState", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the pipeline_state for a researcher", async () => {
    const state = { profile: true, enrich: true, scan: false, match: false };
    const chain = makeChain({ data: { pipeline_state: state }, error: null });
    fromMock.mockReturnValue(chain);

    const result = await getPipelineState("jane-smith");

    expect(result).toEqual(state);
    expect(fromMock).toHaveBeenCalledWith("researchers");
  });

  it("returns empty object for a researcher with no pipeline state", async () => {
    const chain = makeChain({ data: { pipeline_state: {} }, error: null });
    fromMock.mockReturnValue(chain);

    const result = await getPipelineState("jane-smith");

    expect(result).toEqual({});
  });

  it("throws when researcher not found", async () => {
    const chain = makeChain({ data: null, error: { message: "Not found" } });
    fromMock.mockReturnValue(chain);

    await expect(getPipelineState("nonexistent")).rejects.toThrow("Not found");
  });
});

describe("updateScholarCandidate", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sets the scholar_candidate with a candidate object", async () => {
    const chain = makeChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    const candidate = { name: "Jane Smith", orcid: "0000-0001-2345-6789" };
    await updateScholarCandidate("jane-smith", candidate);

    expect(chain.update).toHaveBeenCalledWith({ scholar_candidate: candidate });
    expect(chain.eq).toHaveBeenCalledWith("slug", "jane-smith");
  });

  it("clears the scholar_candidate when passed null", async () => {
    const chain = makeChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    await updateScholarCandidate("jane-smith", null);

    expect(chain.update).toHaveBeenCalledWith({ scholar_candidate: null });
  });

  it("throws on DB error", async () => {
    const chain = makeChain({ data: null, error: { message: "Update failed" } });
    fromMock.mockReturnValue(chain);

    await expect(updateScholarCandidate("jane-smith", null)).rejects.toThrow("Update failed");
  });
});

describe("updatePublicationsMd", () => {
  beforeEach(() => jest.clearAllMocks());

  it("writes publications markdown to the researchers table", async () => {
    const chain = makeChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    await updatePublicationsMd("jane-smith", "## Publications\n- Paper 1");

    expect(chain.update).toHaveBeenCalledWith({
      publications_md: "## Publications\n- Paper 1",
    });
    expect(chain.eq).toHaveBeenCalledWith("slug", "jane-smith");
  });
});

describe("updateMatchResultsMd", () => {
  beforeEach(() => jest.clearAllMocks());

  it("writes match results markdown to the researchers table", async () => {
    const chain = makeChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);

    await updateMatchResultsMd("jane-smith", "## Matches\n### Strong\n- AHRC Responsive Mode");

    expect(chain.update).toHaveBeenCalledWith({
      match_results_md: "## Matches\n### Strong\n- AHRC Responsive Mode",
    });
    expect(chain.eq).toHaveBeenCalledWith("slug", "jane-smith");
  });
});

describe("getResearcherFull", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fetches all pipeline-relevant columns in one query", async () => {
    const data = {
      id: "uuid-123",
      slug: "jane-smith",
      name: "Jane Smith",
      cv_text: "Dr Jane Smith, Professor of Quantum Computing",
      enriched_profile: { name: "Jane Smith", research_themes: ["AI"] },
      pipeline_state: { profile: true, enrich: true },
      publications_md: "## Publications\n- Paper 1",
      match_results_md: null,
      scholar_candidate: null,
    };
    const chain = makeChain({ data, error: null });
    fromMock.mockReturnValue(chain);

    const result = await getResearcherFull("jane-smith");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("uuid-123");
    expect(result!.cv_text).toBe("Dr Jane Smith, Professor of Quantum Computing");
    expect(result!.pipeline_state).toEqual({ profile: true, enrich: true });
    expect(result!.publications_md).toBe("## Publications\n- Paper 1");
  });

  it("returns null when researcher does not exist", async () => {
    const chain = makeChain({ data: null, error: { message: "Not found" } });
    fromMock.mockReturnValue(chain);

    const result = await getResearcherFull("nonexistent");

    expect(result).toBeNull();
  });
});
