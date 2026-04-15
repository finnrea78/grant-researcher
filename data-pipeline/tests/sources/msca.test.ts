// MSCA source uses hardcoded action slugs + fetches descriptions per-action.
// The fetch behaviour is tested in integration (ingest command); here we test
// only the normalise transform since there is no parseable HTML page.

import { normaliseMSCA } from "../../src/transforms/normalise-msca";
import type { RawMSCAScheme } from "../../src/transforms/normalise-msca";

const SAMPLE_RAW: RawMSCAScheme = {
  title: "MSCA Postdoctoral Fellowships",
  url: "https://marie-sklodowska-curie-actions.ec.europa.eu/actions/postdoctoral-fellowships",
  status: "open",
  description: "The objective of PFs is to support researchers' careers and foster excellence in research.",
  eligibility: "Researchers must have a doctoral degree or at least 4 years of full-time research experience.",
};

describe("normaliseMSCA", () => {
  it("maps funder fields correctly", () => {
    const result = normaliseMSCA(SAMPLE_RAW);
    expect(result.funder_slug).toBe("european-commission");
    expect(result.funder_name).toBe("Marie Skłodowska-Curie Actions");
  });

  it("maps title, slug, and URL", () => {
    const result = normaliseMSCA(SAMPLE_RAW);
    expect(result.name).toBe("MSCA Postdoctoral Fellowships");
    expect(result.slug).toMatch(/msca/);
    expect(result.url).toContain("postdoctoral-fellowships");
  });

  it("sets source to msca", () => {
    const result = normaliseMSCA(SAMPLE_RAW);
    expect(result.source).toBe("msca");
  });

  it("sets currency to EUR", () => {
    const result = normaliseMSCA(SAMPLE_RAW);
    expect(result.amount_currency).toBe("EUR");
  });

  it("sets funding_type to fellowship", () => {
    const result = normaliseMSCA(SAMPLE_RAW);
    expect(result.funding_type).toBe("fellowship");
  });

  it("maps description", () => {
    const result = normaliseMSCA(SAMPLE_RAW);
    expect(result.description).toContain("researchers' careers");
  });

  it("passes through eligibility", () => {
    const result = normaliseMSCA(SAMPLE_RAW);
    expect(result.eligibility).toContain("doctoral degree");
  });

  it("passes through null eligibility", () => {
    const noElig = { ...SAMPLE_RAW, eligibility: null };
    expect(normaliseMSCA(noElig).eligibility).toBeNull();
  });

  it("sets scope to null", () => {
    expect(normaliseMSCA(SAMPLE_RAW).scope).toBeNull();
  });
});
