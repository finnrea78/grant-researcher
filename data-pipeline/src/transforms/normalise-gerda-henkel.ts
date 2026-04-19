import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

export interface RawGerdaHenkelScheme {
  title: string;
  url: string;
  deadlineRaw: string | null;
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  fundingType: string;
  status: string;
}

export function normaliseGerdaHenkel(raw: RawGerdaHenkelScheme): NormalisedOpportunity {
  // Handle both UK "28 May 2026" and US "April 29, 2026" date formats
  let deadlineText: string | null = null;
  if (raw.deadlineRaw) {
    // US format "Month DD, YYYY" → "DD Month YYYY"
    const usDate = raw.deadlineRaw.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (usDate) {
      deadlineText = `${usDate[2]} ${usDate[1]} ${usDate[3]}`;
    } else {
      deadlineText = raw.deadlineRaw;
    }
  }
  const deadlineDate = deadlineText ? parseDate(deadlineText) : null;

  const amount = parseAmount(raw.amountRaw ?? null, "EUR");
  const currency = amount.currency ?? "EUR";

  // Refine status from deadline date
  let status = raw.status;
  if (deadlineDate) {
    status = new Date(deadlineDate) >= new Date() ? "open" : "closed";
  }

  return {
    funder_slug: "gerda-henkel-foundation",
    funder_name: "Gerda Henkel Foundation",
    name: raw.title,
    slug: slugify(raw.title),
    status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: raw.amountRaw,
    amount_min: null,
    amount_max: amount.max,
    amount_currency: currency,
    url: raw.url,
    funding_type: raw.fundingType,
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "gerda_henkel",
    source_metadata: null,
  };
}
