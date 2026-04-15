import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseDate } from "./parse-dates.js";
import { parseAmount } from "./parse-amounts.js";

export interface RawVivensaGrant {
  title: string;
  url: string;
  status: string; // "open" | "closed"
  statusRaw: string | null;
  deadlineRaw: string | null;
  amountRaw: string | null;
  description: string | null;
}

export function normaliseVivensa(raw: RawVivensaGrant): NormalisedOpportunity {
  const { min, max, currency } = parseAmount(raw.amountRaw, "GBP");
  const deadlineDate =
    raw.deadlineRaw && raw.deadlineRaw !== "Rolling"
      ? parseDate(raw.deadlineRaw)
      : null;

  return {
    funder_slug: "vivensa-foundation",
    funder_name: "Vivensa Foundation",
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
    funding_type: "grant",
    description: raw.description,
    eligibility: null,
    scope: "ageing, dementia, older people",
    source: "vivensa_foundation",
    source_metadata: {
      status_raw: raw.statusRaw,
    },
  };
}
