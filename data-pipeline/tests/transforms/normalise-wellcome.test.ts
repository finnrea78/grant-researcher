import { normaliseWellcome, type RawWellcomeScheme } from "../../src/transforms/normalise-wellcome";

function makeScheme(overrides: Partial<RawWellcomeScheme> = {}): RawWellcomeScheme {
  return {
    title: "Discovery Research",
    url: "/grant-funding/schemes/discovery-research",
    status: "Open",
    deadline: "1 September 2026",
    fundingLevel: "Up to £300,000",
    duration: "Up to 2 years",
    careerStage: "Mid-career and senior researchers",
    location: "UK-based researchers",
    description: "Funding for curiosity-driven research across biomedical science.",
    frequency: "Annual",
    eligibility: null,
    ...overrides,
  };
}

describe("normaliseWellcome", () => {
  it("maps title to name", () => {
    const result = normaliseWellcome(makeScheme());
    expect(result.name).toBe("Discovery Research");
  });

  it("generates slug from title", () => {
    const result = normaliseWellcome(makeScheme());
    expect(result.slug).toBe("discovery-research");
  });

  it("sets funder_slug and funder_name", () => {
    const result = normaliseWellcome(makeScheme());
    expect(result.funder_slug).toBe("wellcome-trust");
    expect(result.funder_name).toBe("Wellcome Trust");
  });

  it("maps status string correctly", () => {
    expect(normaliseWellcome(makeScheme({ status: "Open" })).status).toBe("open");
    expect(normaliseWellcome(makeScheme({ status: "Closed" })).status).toBe("closed");
    expect(normaliseWellcome(makeScheme({ status: "Upcoming" })).status).toBe("upcoming");
  });

  it("parses deadline date", () => {
    const result = normaliseWellcome(makeScheme({ deadline: "1 September 2026" }));
    expect(result.deadline_date).toBe("2026-09-01");
  });

  it("handles missing deadline", () => {
    const result = normaliseWellcome(makeScheme({ deadline: "" }));
    expect(result.deadline_date).toBeNull();
  });

  it("parses funding level as amount", () => {
    const result = normaliseWellcome(makeScheme({ fundingLevel: "Up to £300,000" }));
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBe(30000000); // 300000 * 100 pence
    expect(result.amount_currency).toBe("GBP");
  });

  it("parses funding range", () => {
    const result = normaliseWellcome(makeScheme({ fundingLevel: "£50,000-£200,000" }));
    expect(result.amount_min).toBe(5000000);
    expect(result.amount_max).toBe(20000000);
  });

  it("handles missing funding level", () => {
    const result = normaliseWellcome(makeScheme({ fundingLevel: "" }));
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBeNull();
  });

  it("maps description", () => {
    const result = normaliseWellcome(makeScheme());
    expect(result.description).toBe("Funding for curiosity-driven research across biomedical science.");
  });

  it("constructs full URL from relative path", () => {
    const result = normaliseWellcome(makeScheme());
    expect(result.url).toBe("https://wellcome.org/grant-funding/schemes/discovery-research");
  });

  it("preserves full URL if already absolute", () => {
    const result = normaliseWellcome(makeScheme({
      url: "https://wellcome.org/some-other-page",
    }));
    expect(result.url).toBe("https://wellcome.org/some-other-page");
  });

  it("sets source to wellcome", () => {
    const result = normaliseWellcome(makeScheme());
    expect(result.source).toBe("wellcome");
  });

  it("stores career stage, location, duration, frequency in source_metadata", () => {
    const result = normaliseWellcome(makeScheme());
    expect(result.source_metadata).toEqual({
      career_stage: "Mid-career and senior researchers",
      location_requirement: "UK-based researchers",
      duration: "Up to 2 years",
      frequency: "Annual",
    });
  });
});
