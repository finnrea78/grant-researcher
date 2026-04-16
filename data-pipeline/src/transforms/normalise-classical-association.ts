import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawClassicalAssocGrant {
  title: string;
  url: string;
  status: string;
  description: string | null;
  amountRaw: string | null;
  deadlineRaw: string | null;
}

export function normaliseClassicalAssoc(raw: RawClassicalAssocGrant): NormalisedOpportunity {
  // "£5,000 and over" → treat amount as min only (no max)
  // "up to £4,999" → treat as max only
  let amountForParsing = raw.amountRaw;
  let overrideMin: number | null = null;

  if (raw.amountRaw?.includes("and over") || raw.amountRaw?.includes("+")) {
    // Extract the lower bound as min
    const match = raw.amountRaw.match(/£([\d,]+)/);
    if (match) {
      overrideMin = Math.round(parseFloat(match[1].replace(/,/g, "")) * 100);
    }
    amountForParsing = null; // don't let parseAmount set a max
  }

  const { min, max, currency } = parseAmount(amountForParsing, "GBP");
  const deadlineDate = raw.deadlineRaw ? parseDate(raw.deadlineRaw) : null;

  return {
    funder_slug: "classical-association",
    funder_name: "The Classical Association",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: raw.amountRaw,
    amount_min: overrideMin ?? min,
    amount_max: max,
    amount_currency: currency,
    url: raw.url,
    funding_type: "grant",
    description: raw.description,
    eligibility: "Schoolteachers, students, academics and organisations. Applications must demonstrate a clear link to Ancient Greece and Rome.",
    scope: null,
    source: "classical_association",
    source_metadata: {},
  };
}
