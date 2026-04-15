import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";

export interface RawHfspGrant {
  title: string;
  url: string;
  fundingType: string;
  status: string;
  deadlineRaw: string | null; // first deadline date text (LOI submission)
  allDates: string[];         // all deadline dates extracted
  description: string | null;
}

/**
 * Normalise a date string that may be in US format "Month DD, YYYY"
 * or UK format "DD Month YYYY".
 */
function normaliseDateString(raw: string): string | null {
  // "May 12, 2026" → "12 May 2026"
  const usMatch = raw.match(/^(\w+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (usMatch) return `${usMatch[2]} ${usMatch[1]} ${usMatch[3]}`;
  return raw; // already in UK format or unrecognised
}

export function normaliseHfsp(raw: RawHfspGrant): NormalisedOpportunity {
  const normalisedDate = raw.deadlineRaw ? normaliseDateString(raw.deadlineRaw) : null;
  const deadlineDate = normalisedDate ? parseDate(normalisedDate) : null;

  return {
    funder_slug: "hfsp",
    funder_name: "Human Frontier Science Program",
    name: raw.title,
    slug: slugify(raw.title),
    status: raw.status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: null,
    amount_min: null,
    amount_max: null,
    amount_currency: "USD",
    url: raw.url,
    funding_type: raw.fundingType,
    description: raw.description,
    eligibility: null,
    scope: "frontier life science, interdisciplinary biology",
    source: "hfsp",
    source_metadata: {
      all_deadline_dates: raw.allDates,
    },
  };
}
