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

import { updateProfileEmbedding, getResearcherForMatching } from "@/lib/researcher-store";

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
