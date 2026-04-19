import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

export interface RawLeverhulmeScheme {
  title: string;
  url: string;
  status: string;
  deadlineText: string | null;
  nextOpeningText: string | null;
  value: string;
  duration: string;
  description: string;
  eligibility: string | null;
}

export function normaliseLeverhulme(raw: RawLeverhulmeScheme): NormalisedOpportunity {
  // Strip time portion from deadline (e.g. "8 May 2026, 4pm" → "8 May 2026")
  const cleanDeadline = raw.deadlineText
    ? raw.deadlineText.replace(/,\s*\d+(?::\d+)?(?:am|pm)?$/i, "").trim()
    : null;
  const deadlineDate = cleanDeadline ? parseDate(cleanDeadline) : null;

  const amount = parseAmount(raw.value || null);

  return {
    funder_slug: "leverhulme-trust",
    funder_name: "Leverhulme Trust",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineText,
    deadline_date: deadlineDate,
    amount_raw: raw.value || null,
    amount_min: amount.min,
    amount_max: amount.max,
    amount_currency: amount.currency,
    url: raw.url,
    funding_type: null,
    description: raw.description || null,
    eligibility: raw.eligibility || null,
    scope: null,
    source: "leverhulme",
    source_metadata: {
      duration: raw.duration,
      next_opening: raw.nextOpeningText ?? null,
    },
  };
}
