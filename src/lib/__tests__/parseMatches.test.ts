import { parseMatches } from "@/lib/parseMatches";

const SAMPLE_MATCHES = `
# Grant Matches for Dr. Will Rea

> Generated: 2026-03-31

## Tier 1: Strong Matches (score 7.0+)

### 1. Research Fellowship — Leverhulme Trust
- **Overall score:** 8.4/10
- **Amount:** £30,000–£100,000 | **Deadline:** rolling | **Status:** open
- **Why this matches:**
  - Strong thematic alignment.

### 2. Small Research Grant — British Academy
- **Overall score:** 7.9/10
- **Amount:** up to £10,000 | **Deadline:** 2026-10-01 | **Status:** open

## Tier 2: Worth Exploring (score 4.0–6.9)

### 3. Scholars Program — Getty Foundation
- **Overall score:** 5.2/10
- **Amount:** residential | **Deadline:** 2026-11-15 | **Status:** open
`.trim();

describe("parseMatches", () => {
  it("returns a Match array", () => {
    const matches = parseMatches(SAMPLE_MATCHES);
    expect(Array.isArray(matches)).toBe(true);
  });

  it("parses correct number of matches", () => {
    const matches = parseMatches(SAMPLE_MATCHES);
    expect(matches).toHaveLength(3);
  });

  it("extracts scheme and funder", () => {
    const matches = parseMatches(SAMPLE_MATCHES);
    expect(matches[0].scheme).toBe("Research Fellowship");
    expect(matches[0].funder).toBe("Leverhulme Trust");
  });

  it("extracts score as number", () => {
    const matches = parseMatches(SAMPLE_MATCHES);
    expect(matches[0].score).toBe(8.4);
  });

  it("extracts tier", () => {
    const matches = parseMatches(SAMPLE_MATCHES);
    expect(matches[0].tier).toBe(1);
    expect(matches[2].tier).toBe(2);
  });

  it("extracts amount and deadline", () => {
    const matches = parseMatches(SAMPLE_MATCHES);
    expect(matches[0].amount).toBe("£30,000–£100,000");
    expect(matches[0].deadline).toBe("rolling");
  });

  it("returns empty array for empty input", () => {
    expect(parseMatches("")).toEqual([]);
  });

  it("excludes entries under ## Not Eligible section", () => {
    const withNotEligible = SAMPLE_MATCHES + `

## Not Eligible

### 4. Ineligible Scheme — Some Funder
- **Overall score:** 0/10
- **Amount:** £100,000 | **Deadline:** 2027-01-01 | **Status:** open
- **Reason:** Career stage mismatch.
`;
    const matches = parseMatches(withNotEligible);
    expect(matches).toHaveLength(3);
    expect(matches.every((m) => m.scheme !== "Ineligible Scheme")).toBe(true);
  });
});
