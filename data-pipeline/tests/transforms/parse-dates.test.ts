import { parseDate } from "../../src/transforms/parse-dates";

describe("parseDate", () => {
  describe("null / missing / sentinel input", () => {
    it("returns null for null", () => {
      expect(parseDate(null)).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(parseDate(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseDate("")).toBeNull();
    });

    it("returns null for 'tbc'", () => {
      expect(parseDate("tbc")).toBeNull();
    });

    it("returns null for 'TBC'", () => {
      expect(parseDate("TBC")).toBeNull();
    });

    it("returns null for 'tba'", () => {
      expect(parseDate("tba")).toBeNull();
    });

    it("returns null for 'n/a'", () => {
      expect(parseDate("n/a")).toBeNull();
    });

    it("returns null for 'varies'", () => {
      expect(parseDate("varies")).toBeNull();
    });

    it("returns null for 'rolling'", () => {
      expect(parseDate("rolling")).toBeNull();
    });
  });

  describe("ISO format passthrough", () => {
    it("returns ISO date unchanged", () => {
      expect(parseDate("2026-05-08")).toBe("2026-05-08");
    });

    it("extracts date from ISO datetime", () => {
      expect(parseDate("2026-05-08T14:30:00Z")).toBe("2026-05-08");
    });
  });

  describe("'DD Month YYYY' format", () => {
    it("parses '8 May 2026'", () => {
      expect(parseDate("8 May 2026")).toBe("2026-05-08");
    });

    it("parses '15 January 2027'", () => {
      expect(parseDate("15 January 2027")).toBe("2027-01-15");
    });

    it("parses '1 December 2025'", () => {
      expect(parseDate("1 December 2025")).toBe("2025-12-01");
    });

    it("pads single-digit day", () => {
      expect(parseDate("3 June 2026")).toBe("2026-06-03");
    });

    it("handles trailing text like ', 4pm'", () => {
      expect(parseDate("8 May 2026, 4pm")).toBe("2026-05-08");
    });

    it("handles lowercase month", () => {
      expect(parseDate("8 may 2026")).toBe("2026-05-08");
    });
  });

  describe("'Month YYYY' format", () => {
    it("parses 'January 2027' as first of month", () => {
      expect(parseDate("January 2027")).toBe("2027-01-01");
    });

    it("parses 'March 2026' as first of month", () => {
      expect(parseDate("March 2026")).toBe("2026-03-01");
    });

    it("parses 'December 2025' as first of month", () => {
      expect(parseDate("December 2025")).toBe("2025-12-01");
    });
  });

  describe("unrecognised formats", () => {
    it("returns null for unknown format", () => {
      expect(parseDate("next spring")).toBeNull();
    });

    it("returns null for month with unknown name", () => {
      expect(parseDate("Quatember 2026")).toBeNull();
    });
  });
});
