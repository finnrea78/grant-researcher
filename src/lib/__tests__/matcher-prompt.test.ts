import { MATCHER_SCORE_PROMPT } from "@/lib/prompts/matcher";

describe("MATCHER_SCORE_PROMPT schema contract", () => {
  it("instructs JSON array output, not Write tool", () => {
    expect(MATCHER_SCORE_PROMPT).not.toMatch(/Write tool/i);
    expect(MATCHER_SCORE_PROMPT).not.toMatch(/Write one JSON file/i);
    expect(MATCHER_SCORE_PROMPT).toMatch(/JSON array/i);
  });

  it("uses score_* field names matching the match route schema", () => {
    expect(MATCHER_SCORE_PROMPT).toMatch(/score_overall/);
    expect(MATCHER_SCORE_PROMPT).toMatch(/score_thematic/);
    expect(MATCHER_SCORE_PROMPT).toMatch(/score_track_record/);
    expect(MATCHER_SCORE_PROMPT).toMatch(/score_strategic/);
    expect(MATCHER_SCORE_PROMPT).toMatch(/score_practical/);
  });

  it("includes tier, funder_slug, scheme_slug fields", () => {
    expect(MATCHER_SCORE_PROMPT).toMatch(/\btier\b/);
    expect(MATCHER_SCORE_PROMPT).toMatch(/funder_slug/);
    expect(MATCHER_SCORE_PROMPT).toMatch(/scheme_slug/);
  });

  it("references proposal-intent context", () => {
    expect(MATCHER_SCORE_PROMPT).toMatch(/proposal.intent/i);
  });

  it("specifies strengths and weaknesses as arrays", () => {
    expect(MATCHER_SCORE_PROMPT).toMatch(/strengths.*string\[\]/s);
    expect(MATCHER_SCORE_PROMPT).toMatch(/weaknesses.*string\[\]/s);
  });
});
