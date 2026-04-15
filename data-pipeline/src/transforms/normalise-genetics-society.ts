import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawGeneticsSocietyGrant {
  title: string;
  url: string;
  status: string;
  deadlineRaw: string | null;
  amountRaw: string | null;
  description: string | null;
}

export function normaliseGeneticsSociety(raw: RawGeneticsSocietyGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");
  // Only parse deadline_date if the raw string contains a 4-digit year
  const deadlineDate =
    raw.deadlineRaw && /\d{4}/.test(raw.deadlineRaw)
      ? parseDate(raw.deadlineRaw)
      : null;

  return {
    funder_slug: "genetics-society",
    funder_name: "Genetics Society",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: raw.amountRaw,
    amount_min: min,
    amount_max: max,
    amount_currency: currency,
    url: raw.url,
    funding_type: raw.title.toLowerCase().includes("studentship") ? "studentship" : "grant",
    description: raw.description,
    eligibility: null,
    scope: "genetics, genomics, heredity",
    source: "genetics_society",
    source_metadata: {},
  };
}
