// data-pipeline/tests/lib/embedder.test.ts
import { buildOpportunityText } from "../../src/lib/embedder";

const MAX_CHARS = 32000;

describe("buildOpportunityText", () => {
  it("joins name, description, scope, eligibility with period-space", () => {
    const text = buildOpportunityText({
      name: "Research Grant",
      description: "Fund foundational research",
      scope: "Any discipline",
      eligibility: "Early career only",
    });
    expect(text).toContain("Research Grant");
    expect(text).toContain("Fund foundational research");
    expect(text).toContain("Any discipline");
    expect(text).toContain("Early career only");
  });

  it("omits null fields without leaving empty segments", () => {
    const text = buildOpportunityText({
      name: "Fellowship",
      description: null,
      scope: null,
      eligibility: null,
    });
    expect(text).toBe("Fellowship");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
  });

  it("omits empty string fields", () => {
    const text = buildOpportunityText({
      name: "Fellowship",
      description: "",
      scope: "STEM",
      eligibility: null,
    });
    expect(text).not.toContain(". ."); // no double separators
    expect(text).toContain("STEM");
  });

  it("truncates text exceeding MAX_CHARS", () => {
    const longText = "x".repeat(40000);
    const text = buildOpportunityText({
      name: longText,
      description: null,
      scope: null,
      eligibility: null,
    });
    expect(text.length).toBeLessThanOrEqual(MAX_CHARS);
  });
});
