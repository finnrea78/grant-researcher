import { normaliseLeverhulme, type RawLeverhulmeScheme } from "../../src/transforms/normalise-leverhulme";

function makeScheme(overrides: Partial<RawLeverhulmeScheme> = {}): RawLeverhulmeScheme {
  return {
    title: "Research Project Grants",
    url: "https://www.leverhulme.ac.uk/research-project-grants",
    status: "open",
    deadlineText: "8 May 2026, 4pm",
    nextOpeningText: null,
    value: "Up to £500,000",
    duration: "Up to 5 years",
    description: "Support for original research of recognised excellence.",
    ...overrides,
  };
}

describe("normaliseLeverhulme", () => {
  it("maps title to name", () => {
    const result = normaliseLeverhulme(makeScheme());
    expect(result.name).toBe("Research Project Grants");
  });

  it("generates slug from title", () => {
    const result = normaliseLeverhulme(makeScheme());
    expect(result.slug).toBe("research-project-grants");
  });

  it("sets funder_slug and funder_name", () => {
    const result = normaliseLeverhulme(makeScheme());
    expect(result.funder_slug).toBe("leverhulme-trust");
    expect(result.funder_name).toBe("Leverhulme Trust");
  });

  it("passes through open status", () => {
    const result = normaliseLeverhulme(makeScheme({ status: "open" }));
    expect(result.status).toBe("open");
  });

  it("passes through closed status", () => {
    const result = normaliseLeverhulme(makeScheme({ status: "closed" }));
    expect(result.status).toBe("closed");
  });

  it("parses deadline text to date", () => {
    const result = normaliseLeverhulme(makeScheme({ deadlineText: "8 May 2026, 4pm" }));
    expect(result.deadline_date).toBe("2026-05-08");
  });

  it("handles missing deadline text", () => {
    const result = normaliseLeverhulme(makeScheme({ deadlineText: null }));
    expect(result.deadline_date).toBeNull();
  });

  it("parses 'Up to £X' amount as max", () => {
    const result = normaliseLeverhulme(makeScheme({ value: "Up to £500,000" }));
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBe(50000000); // 500000 * 100 pence
    expect(result.amount_currency).toBe("GBP");
  });

  it("parses fixed amount as max", () => {
    const result = normaliseLeverhulme(makeScheme({ value: "£130,000" }));
    expect(result.amount_max).toBe(13000000);
  });

  it("parses range", () => {
    const result = normaliseLeverhulme(makeScheme({ value: "£3,000–£24,000" }));
    expect(result.amount_min).toBe(300000);
    expect(result.amount_max).toBe(2400000);
  });

  it("handles missing value", () => {
    const result = normaliseLeverhulme(makeScheme({ value: "" }));
    expect(result.amount_min).toBeNull();
    expect(result.amount_max).toBeNull();
  });

  it("uses provided url", () => {
    const result = normaliseLeverhulme(makeScheme());
    expect(result.url).toBe("https://www.leverhulme.ac.uk/research-project-grants");
  });

  it("maps description", () => {
    const result = normaliseLeverhulme(makeScheme());
    expect(result.description).toBe("Support for original research of recognised excellence.");
  });

  it("sets source to leverhulme", () => {
    const result = normaliseLeverhulme(makeScheme());
    expect(result.source).toBe("leverhulme");
  });

  it("stores duration and next opening in source_metadata", () => {
    const result = normaliseLeverhulme(makeScheme({
      duration: "Up to 5 years",
      nextOpeningText: "1 January 2027",
    }));
    expect(result.source_metadata).toEqual({
      duration: "Up to 5 years",
      next_opening: "1 January 2027",
    });
  });

  it("stores null next_opening when not available", () => {
    const result = normaliseLeverhulme(makeScheme({ nextOpeningText: null }));
    expect(result.source_metadata).toEqual({
      duration: "Up to 5 years",
      next_opening: null,
    });
  });
});
