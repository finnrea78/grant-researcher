// src/lib/__tests__/researcher-store.test.ts

// ─── Mock Supabase ────────────────────────────────────────────────────────────
function makeChain(resolveValue: unknown) {
  const c = {
    select: jest.fn(),
    eq: jest.fn(),
    update: jest.fn(),
    single: jest.fn(),
    then: jest.fn(),
  };
  c.select.mockReturnValue(c);
  c.eq.mockReturnValue(c);
  c.update.mockReturnValue(c);
  c.single.mockReturnValue(Promise.resolve(resolveValue));
  c.then.mockImplementation((resolve: (v: unknown) => void) => {
    resolve(resolveValue);
    return Promise.resolve(resolveValue);
  });
  return c;
}

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

// ─── Mock src embedder ────────────────────────────────────────────────────────
const mockEmbedText = jest.fn().mockResolvedValue(Array(1536).fill(0.3));
jest.mock("@/lib/embedder", () => ({
  embedText: mockEmbedText,
}));

import {
  updateProfileEmbedding,
  getResearcherForMatching,
  updatePipelineState,
  updatePublications,
  updateMatchResults,
  updateScholarCandidate,
  getResearcherPipelineState,
} from "@/lib/researcher-store";

let currentChain: ReturnType<typeof makeChain>;

function setupChain(resolveValue: unknown) {
  currentChain = makeChain(resolveValue);
  mockFrom.mockReturnValue(currentChain);
}

beforeEach(() => jest.clearAllMocks());

// ─── updateProfileEmbedding ───────────────────────────────────────────────────

describe("updateProfileEmbedding", () => {
  it("calls embedText with the summary and stores the result", async () => {
    setupChain({ error: null });

    await updateProfileEmbedding("jane-smith", "Jane studies marine acoustics...");

    expect(mockEmbedText).toHaveBeenCalledWith("Jane studies marine acoustics...");
    expect(mockFrom).toHaveBeenCalledWith("researchers");
    expect(currentChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ profile_embedding: Array(1536).fill(0.3) })
    );
  });

  it("throws when Supabase returns an error", async () => {
    setupChain({ error: { message: "Update failed" } });

    await expect(
      updateProfileEmbedding("jane-smith", "summary text")
    ).rejects.toThrow("Update failed");
  });
});

// ─── getResearcherForMatching ─────────────────────────────────────────────────

describe("getResearcherForMatching", () => {
  it("returns profile_embedding, research_themes, research_keywords", async () => {
    const fakeEmbedding = Array(1536).fill(0.5);
    setupChain({
      data: {
        profile_embedding: fakeEmbedding,
        research_themes: ["ecology", "climate"],
        research_keywords: ["marine", "carbon"],
      },
      error: null,
    });

    const result = await getResearcherForMatching("jane-smith");

    expect(mockFrom).toHaveBeenCalledWith("researchers");
    expect(result.profile_embedding).toEqual(fakeEmbedding);
    expect(result.research_themes).toEqual(["ecology", "climate"]);
    expect(result.research_keywords).toEqual(["marine", "carbon"]);
  });

  it("returns null profile_embedding when researcher has none", async () => {
    setupChain({
      data: { profile_embedding: null, research_themes: [], research_keywords: [] },
      error: null,
    });

    const result = await getResearcherForMatching("new-researcher");
    expect(result.profile_embedding).toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    setupChain({ data: null, error: { message: "Not found" } });
    await expect(getResearcherForMatching("ghost")).rejects.toThrow("Not found");
  });
});

// ─── updatePipelineState ──────────────────────────────────────────────────────

describe("updatePipelineState", () => {
  it("reads current pipeline_state then merges the new stage", async () => {
    // First call: select returns existing state; second call: update returns no error
    const selectChain = makeChain({
      data: { pipeline_state: { profile: true } },
      error: null,
    });
    const updateChain = makeChain({ error: null });
    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValue(updateChain);

    await updatePipelineState("jane-smith", "enrich");

    expect(mockFrom).toHaveBeenCalledWith("researchers");
    expect(selectChain.select).toHaveBeenCalledWith("pipeline_state");
    expect(selectChain.eq).toHaveBeenCalledWith("slug", "jane-smith");
    expect(updateChain.update).toHaveBeenCalledWith({
      pipeline_state: { profile: true, enrich: true },
    });
    expect(updateChain.eq).toHaveBeenCalledWith("slug", "jane-smith");
  });

  it("handles missing pipeline_state (null) by treating it as empty object", async () => {
    const selectChain = makeChain({
      data: { pipeline_state: null },
      error: null,
    });
    const updateChain = makeChain({ error: null });
    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValue(updateChain);

    await updatePipelineState("jane-smith", "profile");

    expect(updateChain.update).toHaveBeenCalledWith({
      pipeline_state: { profile: true },
    });
  });

  it("throws when the select call returns an error", async () => {
    const selectChain = makeChain({ data: null, error: { message: "Read failed" } });
    mockFrom.mockReturnValue(selectChain);

    await expect(updatePipelineState("jane-smith", "scan")).rejects.toThrow("Read failed");
  });

  it("throws when the update call returns an error", async () => {
    const selectChain = makeChain({
      data: { pipeline_state: {} },
      error: null,
    });
    const updateChain = makeChain({ error: { message: "Write failed" } });
    mockFrom
      .mockReturnValueOnce(selectChain)
      .mockReturnValue(updateChain);

    await expect(updatePipelineState("jane-smith", "match")).rejects.toThrow("Write failed");
  });
});

// ─── updatePublications ───────────────────────────────────────────────────────

describe("updatePublications", () => {
  it("calls update with publications_md and eq with slug", async () => {
    setupChain({ error: null });

    await updatePublications("jane-smith", "## Publications\n- Paper 1");

    expect(mockFrom).toHaveBeenCalledWith("researchers");
    expect(currentChain.update).toHaveBeenCalledWith({
      publications_md: "## Publications\n- Paper 1",
    });
    expect(currentChain.eq).toHaveBeenCalledWith("slug", "jane-smith");
  });

  it("throws when Supabase returns an error", async () => {
    setupChain({ error: { message: "Publications update failed" } });

    await expect(
      updatePublications("jane-smith", "# pubs")
    ).rejects.toThrow("Publications update failed");
  });
});

// ─── updateMatchResults ───────────────────────────────────────────────────────

describe("updateMatchResults", () => {
  it("calls update with match_results_md and eq with slug", async () => {
    setupChain({ error: null });

    await updateMatchResults("jane-smith", "## Matches\n- Grant A");

    expect(mockFrom).toHaveBeenCalledWith("researchers");
    expect(currentChain.update).toHaveBeenCalledWith({
      match_results_md: "## Matches\n- Grant A",
    });
    expect(currentChain.eq).toHaveBeenCalledWith("slug", "jane-smith");
  });

  it("throws when Supabase returns an error", async () => {
    setupChain({ error: { message: "Match results update failed" } });

    await expect(
      updateMatchResults("jane-smith", "# matches")
    ).rejects.toThrow("Match results update failed");
  });
});

// ─── updateScholarCandidate ───────────────────────────────────────────────────

describe("updateScholarCandidate", () => {
  it("calls update with scholar_candidate object and eq with slug", async () => {
    setupChain({ error: null });
    const candidate = { name: "Jane Smith", url: "https://scholar.google.com/citations?user=abc" };

    await updateScholarCandidate("jane-smith", candidate);

    expect(mockFrom).toHaveBeenCalledWith("researchers");
    expect(currentChain.update).toHaveBeenCalledWith({ scholar_candidate: candidate });
    expect(currentChain.eq).toHaveBeenCalledWith("slug", "jane-smith");
  });

  it("calls update with null to clear the candidate", async () => {
    setupChain({ error: null });

    await updateScholarCandidate("jane-smith", null);

    expect(currentChain.update).toHaveBeenCalledWith({ scholar_candidate: null });
  });

  it("throws when Supabase returns an error", async () => {
    setupChain({ error: { message: "Scholar candidate update failed" } });

    await expect(
      updateScholarCandidate("jane-smith", null)
    ).rejects.toThrow("Scholar candidate update failed");
  });
});

// ─── getResearcherPipelineState ───────────────────────────────────────────────

describe("getResearcherPipelineState", () => {
  it("returns pipeline_state, scholar_candidate, match_results_md when found", async () => {
    setupChain({
      data: {
        pipeline_state: { profile: true, enrich: true },
        scholar_candidate: { name: "Jane Smith" },
        match_results_md: "## Matches",
      },
      error: null,
    });

    const result = await getResearcherPipelineState("jane-smith");

    expect(mockFrom).toHaveBeenCalledWith("researchers");
    expect(result).toEqual({
      pipeline_state: { profile: true, enrich: true },
      scholar_candidate: { name: "Jane Smith" },
      match_results_md: "## Matches",
    });
  });

  it("returns null when data is null (researcher not found)", async () => {
    // single() with PGRST116 (no rows) returns error, but we test the data=null branch
    setupChain({ data: null, error: null });

    const result = await getResearcherPipelineState("ghost");
    expect(result).toBeNull();
  });

  it("returns defaults for null fields when researcher exists", async () => {
    setupChain({
      data: {
        pipeline_state: null,
        scholar_candidate: null,
        match_results_md: null,
      },
      error: null,
    });

    const result = await getResearcherPipelineState("jane-smith");
    expect(result).toEqual({
      pipeline_state: {},
      scholar_candidate: null,
      match_results_md: null,
    });
  });

  it("throws when Supabase returns an error", async () => {
    setupChain({ data: null, error: { message: "DB error" } });

    await expect(getResearcherPipelineState("jane-smith")).rejects.toThrow("DB error");
  });
});
