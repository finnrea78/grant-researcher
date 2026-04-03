export interface ParsedAmount {
  min: number | null;
  max: number | null;
  currency: string;
}

/**
 * Parse a grant amount string or number into structured pence values.
 * Amounts are stored in pence (integer) to avoid floating point issues.
 * If given a number (e.g. from GtR valuePounds), treat it as whole pounds.
 */
export function parseAmount(
  input: string | number | null | undefined,
  defaultCurrency = "GBP"
): ParsedAmount {
  if (input == null) return { min: null, max: null, currency: defaultCurrency };

  // Numeric input (GtR valuePounds is in whole pounds)
  if (typeof input === "number") {
    const pence = Math.round(input * 100);
    return { min: pence, max: pence, currency: defaultCurrency };
  }

  const text = input.trim();
  if (!text || /^(varies|tbc|tba|n\/a)$/i.test(text)) {
    return { min: null, max: null, currency: defaultCurrency };
  }

  // Detect currency
  let currency = defaultCurrency;
  if (/EUR|€/.test(text)) currency = "EUR";
  else if (/USD|\$/.test(text)) currency = "USD";
  else if (/£|GBP/.test(text)) currency = "GBP";

  const toPence = (raw: string): number | null => {
    // Remove currency symbols, commas, spaces
    let cleaned = raw.replace(/[£€$,\s]/g, "");
    let multiplier = 100; // pence
    if (/million/i.test(text)) {
      // "2.5 million" -> parse "2.5", multiply by 1_000_000 * 100
      cleaned = cleaned.replace(/million/i, "").trim();
      multiplier = 100_000_000;
    } else if (/k$/i.test(cleaned)) {
      cleaned = cleaned.replace(/k$/i, "");
      multiplier = 100_000;
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : Math.round(num * multiplier);
  };

  // Range: "£3,000-£24,000" or "£3,000 - £24,000"
  const rangeMatch = text.match(
    /([£€$]?[\d,.]+(?:\s*(?:million|k))?)\s*[-–]\s*([£€$]?[\d,.]+(?:\s*(?:million|k))?)/i
  );
  if (rangeMatch) {
    return { min: toPence(rangeMatch[1]), max: toPence(rangeMatch[2]), currency };
  }

  // "Up to X" or "up to X"
  const upToMatch = text.match(/up\s+to\s+([£€$]?[\d,.]+(?:\s*(?:million|k))?)/i);
  if (upToMatch) {
    return { min: null, max: toPence(upToMatch[1]), currency };
  }

  // Single value: "£250,000" or "EUR 2.5 million"
  const singleMatch = text.match(/([£€$]?\s*[\d,.]+(?:\s*(?:million|k))?)/i);
  if (singleMatch) {
    const val = toPence(singleMatch[1]);
    return { min: val, max: val, currency };
  }

  return { min: null, max: null, currency };
}
