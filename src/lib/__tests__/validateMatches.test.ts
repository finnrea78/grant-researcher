import { validateMatches } from "@/lib/validateMatches";
import type { Match } from "@/lib/parseMatches";

const NOW = new Date("2026-04-08");

function match(overrides: Partial<Match>): Match {
  return {
    scheme: "Test Scheme",
    funder: "Test Funder",
    score: 7.5,
    amount: "£50,000",
    deadline: "2027-01-01",
    tier: 1,
    ...overrides,
  };
}

describe("validateMatches", () => {
  it("returns empty array for empty input", () => {
    expect(validateMatches([], NOW)).toEqual([]);
  });

  it("passes through all valid matches unchanged", () => {
    const matches = [match({}), match({ tier: 2, score: 5.0 })];
    expect(validateMatches(matches, NOW)).toEqual(matches);
  });

  describe("score floor", () => {
    it("removes matches with score 0", () => {
      const result = validateMatches([match({ score: 0 })], NOW);
      expect(result).toHaveLength(0);
    });

    it("removes matches with score below 0", () => {
      const result = validateMatches([match({ score: -1 })], NOW);
      expect(result).toHaveLength(0);
    });

    it("keeps matches with score above 0", () => {
      const result = validateMatches([match({ score: 0.5 })], NOW);
      expect(result).toHaveLength(1);
    });
  });

  describe("expired deadline", () => {
    it("removes matches with an expired ISO date deadline", () => {
      const result = validateMatches([match({ deadline: "2025-01-01" })], NOW);
      expect(result).toHaveLength(0);
    });

    it("keeps matches with a future ISO date deadline", () => {
      const result = validateMatches([match({ deadline: "2027-12-01" })], NOW);
      expect(result).toHaveLength(1);
    });

    it("keeps matches with 'rolling' deadline", () => {
      const result = validateMatches([match({ deadline: "rolling" })], NOW);
      expect(result).toHaveLength(1);
    });

    it("keeps matches with 'TBC' deadline", () => {
      const result = validateMatches([match({ deadline: "TBC" })], NOW);
      expect(result).toHaveLength(1);
    });

    it("keeps matches with 'TBC (pre-announcement)' deadline", () => {
      const result = validateMatches([match({ deadline: "TBC (pre-announcement)" })], NOW);
      expect(result).toHaveLength(1);
    });

    it("keeps matches with empty deadline string", () => {
      const result = validateMatches([match({ deadline: "" })], NOW);
      expect(result).toHaveLength(1);
    });
  });

  describe("combined filters", () => {
    it("removes a match with both score 0 and expired deadline (counted once)", () => {
      const result = validateMatches([match({ score: 0, deadline: "2025-01-01" })], NOW);
      expect(result).toHaveLength(0);
    });

    it("filters independently — keeps valid, removes invalid", () => {
      const input = [
        match({ score: 0 }),
        match({ deadline: "2025-01-01" }),
        match({ score: 8.0, deadline: "2027-06-01" }),
      ];
      const result = validateMatches(input, NOW);
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(8.0);
    });
  });
});
