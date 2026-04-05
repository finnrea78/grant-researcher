import { parseAmount } from "../../src/transforms/parse-amounts";

describe("parseAmount", () => {
  describe("null / missing input", () => {
    it("returns nulls for null", () => {
      expect(parseAmount(null)).toEqual({ min: null, max: null, currency: "GBP" });
    });

    it("returns nulls for undefined", () => {
      expect(parseAmount(undefined)).toEqual({ min: null, max: null, currency: "GBP" });
    });

    it("returns nulls for 'varies'", () => {
      expect(parseAmount("varies")).toEqual({ min: null, max: null, currency: "GBP" });
    });

    it("returns nulls for 'tbc'", () => {
      expect(parseAmount("tbc")).toEqual({ min: null, max: null, currency: "GBP" });
    });

    it("returns nulls for 'TBA'", () => {
      expect(parseAmount("TBA")).toEqual({ min: null, max: null, currency: "GBP" });
    });

    it("returns nulls for 'n/a'", () => {
      expect(parseAmount("n/a")).toEqual({ min: null, max: null, currency: "GBP" });
    });

    it("returns nulls for empty string", () => {
      expect(parseAmount("")).toEqual({ min: null, max: null, currency: "GBP" });
    });
  });

  describe("numeric input (GtR valuePounds)", () => {
    it("converts whole pounds to pence", () => {
      expect(parseAmount(1000)).toEqual({ min: 100000, max: 100000, currency: "GBP" });
    });

    it("handles fractional pounds", () => {
      expect(parseAmount(250000.5)).toEqual({ min: 25000050, max: 25000050, currency: "GBP" });
    });

    it("handles zero", () => {
      expect(parseAmount(0)).toEqual({ min: 0, max: 0, currency: "GBP" });
    });
  });

  describe("currency detection", () => {
    it("detects GBP from £ symbol", () => {
      expect(parseAmount("£50,000")).toMatchObject({ currency: "GBP" });
    });

    it("detects EUR from € symbol", () => {
      expect(parseAmount("€50,000")).toMatchObject({ currency: "EUR" });
    });

    it("detects USD from $ symbol", () => {
      expect(parseAmount("$50,000")).toMatchObject({ currency: "USD" });
    });

    it("detects EUR from 'EUR' text", () => {
      expect(parseAmount("EUR 50,000")).toMatchObject({ currency: "EUR" });
    });

    it("defaults to GBP when no currency marker", () => {
      expect(parseAmount("50000")).toMatchObject({ currency: "GBP" });
    });

    it("uses defaultCurrency parameter", () => {
      expect(parseAmount("50000", "EUR")).toMatchObject({ currency: "EUR" });
    });
  });

  describe("range parsing", () => {
    it("parses £3,000-£24,000 range", () => {
      expect(parseAmount("£3,000-£24,000")).toEqual({ min: 300000, max: 2400000, currency: "GBP" });
    });

    it("parses range with spaces around dash", () => {
      expect(parseAmount("£3,000 - £24,000")).toEqual({ min: 300000, max: 2400000, currency: "GBP" });
    });

    it("parses range with en-dash", () => {
      expect(parseAmount("£3,000–£24,000")).toEqual({ min: 300000, max: 2400000, currency: "GBP" });
    });
  });

  describe("'up to X' parsing", () => {
    it("sets max only, min null", () => {
      expect(parseAmount("up to £10,000")).toEqual({ min: null, max: 1000000, currency: "GBP" });
    });

    it("handles 'Up to' with capital U", () => {
      expect(parseAmount("Up to £5,000")).toEqual({ min: null, max: 500000, currency: "GBP" });
    });
  });

  describe("single value parsing", () => {
    it("parses £250,000 as both min and max", () => {
      expect(parseAmount("£250,000")).toEqual({ min: 25000000, max: 25000000, currency: "GBP" });
    });

    it("parses value without currency symbol", () => {
      const result = parseAmount("50000");
      expect(result.min).toBe(5000000);
      expect(result.max).toBe(5000000);
    });
  });

  describe("'million' multiplier", () => {
    it("parses '£2.5 million'", () => {
      expect(parseAmount("up to £2.5 million")).toEqual({ min: null, max: 250000000, currency: "GBP" });
    });

    it("parses 'EUR 2 million'", () => {
      expect(parseAmount("EUR 2 million")).toMatchObject({ min: 200000000, max: 200000000, currency: "EUR" });
    });
  });

  describe("'k' suffix", () => {
    it("parses '£50k'", () => {
      expect(parseAmount("£50k")).toEqual({ min: 5000000, max: 5000000, currency: "GBP" });
    });

    it("parses range with k suffix", () => {
      expect(parseAmount("£10k-£50k")).toEqual({ min: 1000000, max: 5000000, currency: "GBP" });
    });
  });
});
