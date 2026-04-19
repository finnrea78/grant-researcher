import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

export interface RawNatgeoGrant {
  title: string;
  url: string | null;
  deadlineRaw: string | null;
  description: string | null;
  eligibility: string | null;
  amountRaw: string | null;
  fundingType: string;
}

export function normaliseNatgeo(raw: RawNatgeoGrant): NormalisedOpportunity {
  // Strip timezone suffix + convert US "Month DD, YYYY" → "DD Month YYYY" for parseDate
  let deadlineText: string | null = null;
  if (raw.deadlineRaw) {
    // Extract just the date part, discarding time/timezone
    const m = raw.deadlineRaw.match(/([A-Za-z]+\s+\d{1,2},?\s+\d{4})/);
    if (m) {
      // "May 25, 2026" → "25 May 2026"
      const usDate = m[1].match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
      deadlineText = usDate ? `${usDate[2]} ${usDate[1]} ${usDate[3]}` : m[1];
    } else {
      deadlineText = raw.deadlineRaw;
    }
  }
  const deadlineDate = deadlineText ? parseDate(deadlineText) : null;

  // Parse amount — NatGeo uses USD
  const amount = parseAmount(raw.amountRaw ?? null);
  const currency = amount.currency !== "GBP" ? amount.currency : (raw.amountRaw ? "USD" : "USD");

  // Derive status from deadline
  let status: string;
  if (deadlineDate) {
    status = new Date(deadlineDate) >= new Date() ? "open" : "closed";
  } else {
    status = "open";
  }

  return {
    funder_slug: "national-geographic-society",
    funder_name: "National Geographic Society",
    name: raw.title,
    slug: slugify(raw.title),
    status,
    deadline_raw: raw.deadlineRaw,
    deadline_date: deadlineDate,
    amount_raw: raw.amountRaw,
    amount_min: amount.min,
    amount_max: amount.max,
    amount_currency: currency,
    url: raw.url ?? "",
    funding_type: raw.fundingType,
    description: raw.description,
    eligibility: raw.eligibility,
    scope: null,
    source: "natgeo",
    source_metadata: {},
  };
}
