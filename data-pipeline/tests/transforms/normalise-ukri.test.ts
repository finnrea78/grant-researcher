import { normaliseUkriOpportunity } from "../../src/transforms/normalise-ukri";
import type { RawUkriOpportunity } from "../../src/sources/ukri-finder";

function makeOpp(overrides: Partial<RawUkriOpportunity> = {}): RawUkriOpportunity {
  return {
    title: "Research Leadership Award",
    url: "https://www.ukri.org/opportunity/research-leadership-award/",
    council: "AHRC",
    closingDate: "15 June 2026",
    fundingAmount: "£50,000-£200,000",
    status: "open",
    fundingType: null,
    description: null,
    eligibility: null,
    scope: null,
    ...overrides,
  };
}

describe("normaliseUkriOpportunity", () => {
  it("generates a slug from the title", () => {
    const result = normaliseUkriOpportunity(makeOpp());
    expect(result.slug).toBe("research-leadership-award");
  });

  it("maps known council codes to slugs", () => {
    expect(normaliseUkriOpportunity(makeOpp({ council: "AHRC" })).funder_slug).toBe("ahrc");
    expect(normaliseUkriOpportunity(makeOpp({ council: "EPSRC" })).funder_slug).toBe("epsrc");
    expect(normaliseUkriOpportunity(makeOpp({ council: "Innovate UK" })).funder_slug).toBe("innovate-uk");
  });

  it("falls back to 'ukri' for null council", () => {
    const result = normaliseUkriOpportunity(makeOpp({ council: null }));
    expect(result.funder_slug).toBe("ukri");
  });

  it("slugifies unknown council names", () => {
    const result = normaliseUkriOpportunity(makeOpp({ council: "Research England" }));
    expect(result.funder_slug).toBe("research-england");
  });

  it("preserves the name field", () => {
    const result = normaliseUkriOpportunity(makeOpp());
    expect(result.name).toBe("Research Leadership Award");
  });

  it("preserves the url field", () => {
    const result = normaliseUkriOpportunity(makeOpp());
    expect(result.url).toBe("https://www.ukri.org/opportunity/research-leadership-award/");
  });

  it("parses a date range for amount_min and amount_max in pence", () => {
    const result = normaliseUkriOpportunity(makeOpp({ fundingAmount: "£50,000-£200,000" }));
    expect(result.amount_min).toBe(5000000);
    expect(result.amount_max).toBe(20000000);
    expect(result.amount_currency).toBe("GBP");
  });

  it("parses 'up to X' amount", () => {
    const result = normaliseUkriOpportunity(makeOpp({ fundingAmount: "up to £10,000" }));
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBe(1000000);
  });

  it("sets amount nulls for missing fundingAmount", () => {
    const result = normaliseUkriOpportunity(makeOpp({ fundingAmount: null }));
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBeNull();
  });

  it("parses ISO closing date", () => {
    const result = normaliseUkriOpportunity(makeOpp({ closingDate: "2026-06-15" }));
    expect(result.deadline_date).toBe("2026-06-15");
  });

  it("parses 'DD Month YYYY' closing date", () => {
    const result = normaliseUkriOpportunity(makeOpp({ closingDate: "15 June 2026" }));
    expect(result.deadline_date).toBe("2026-06-15");
  });

  it("sets deadline_date to null for 'tbc'", () => {
    const result = normaliseUkriOpportunity(makeOpp({ closingDate: "tbc" }));
    expect(result.deadline_date).toBeNull();
  });

  it("sets status from raw opportunity", () => {
    expect(normaliseUkriOpportunity(makeOpp({ status: "open" })).status).toBe("open");
    expect(normaliseUkriOpportunity(makeOpp({ status: "closed" })).status).toBe("closed");
  });

  it("defaults status to 'open' when null", () => {
    const result = normaliseUkriOpportunity(makeOpp({ status: null }));
    expect(result.status).toBe("open");
  });

  it("sets source to 'ukri_funding_finder'", () => {
    const result = normaliseUkriOpportunity(makeOpp());
    expect(result.source).toBe("ukri_funding_finder");
  });

  it("sets fixed null fields", () => {
    const result = normaliseUkriOpportunity(makeOpp());
    expect(result.funding_type).toBeNull();
    expect(result.description).toBeNull();
    expect(result.eligibility).toBeNull();
    expect(result.scope).toBeNull();
  });

  it("stores raw council in source_metadata", () => {
    const result = normaliseUkriOpportunity(makeOpp({ council: "AHRC" }));
    expect(result.source_metadata).toEqual({ council_raw: "AHRC" });
  });
});
