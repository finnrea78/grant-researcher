import { normaliseRoyalSociety, type RawRoyalSocietyScheme } from "../../src/transforms/normalise-royal-society";

function makeScheme(overrides: Partial<RawRoyalSocietyScheme> = {}): RawRoyalSocietyScheme {
  return {
    title: "APEX Awards",
    url: "https://royalsociety.org/grants/apex-awards/",
    status: "open",
    deadlineText: "05 August 2026",
    description: "Awards for excellent scientists to pursue novel interdisciplinary research.",
    eligibility: null,
    ...overrides,
  };
}

describe("normaliseRoyalSociety", () => {
  it("maps title to name", () => {
    const result = normaliseRoyalSociety(makeScheme());
    expect(result.name).toBe("APEX Awards");
  });

  it("generates slug from title", () => {
    const result = normaliseRoyalSociety(makeScheme());
    expect(result.slug).toBe("apex-awards");
  });

  it("sets funder_slug and funder_name", () => {
    const result = normaliseRoyalSociety(makeScheme());
    expect(result.funder_slug).toBe("royal-society");
    expect(result.funder_name).toBe("Royal Society");
  });

  it("passes through open status", () => {
    expect(normaliseRoyalSociety(makeScheme({ status: "open" })).status).toBe("open");
  });

  it("passes through closed status", () => {
    expect(normaliseRoyalSociety(makeScheme({ status: "closed" })).status).toBe("closed");
  });

  it("parses deadlineText to date", () => {
    const result = normaliseRoyalSociety(makeScheme({ deadlineText: "05 August 2026" }));
    expect(result.deadline_date).toBe("2026-08-05");
  });

  it("handles missing deadline", () => {
    const result = normaliseRoyalSociety(makeScheme({ deadlineText: null }));
    expect(result.deadline_date).toBeNull();
  });

  it("sets amount fields to null (not in listing data)", () => {
    const result = normaliseRoyalSociety(makeScheme());
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBeNull();
  });

  it("uses url as-is", () => {
    const result = normaliseRoyalSociety(makeScheme());
    expect(result.url).toBe("https://royalsociety.org/grants/apex-awards/");
  });

  it("maps description", () => {
    const result = normaliseRoyalSociety(makeScheme());
    expect(result.description).toBe("Awards for excellent scientists to pursue novel interdisciplinary research.");
  });

  it("sets source to royal_society", () => {
    const result = normaliseRoyalSociety(makeScheme());
    expect(result.source).toBe("royal_society");
  });

  it("sets amount_currency to GBP", () => {
    const result = normaliseRoyalSociety(makeScheme());
    expect(result.amount_currency).toBe("GBP");
  });
});
