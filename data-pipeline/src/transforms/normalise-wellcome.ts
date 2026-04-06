import type { NormalisedOpportunity } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

export interface RawWellcomeScheme {
  title: string;
  url: string;
  status: string;
  deadline: string;
  fundingLevel: string;
  duration: string;
  careerStage: string;
  location: string;
  description: string;
  frequency: string;
}

const WELLCOME_BASE = "https://wellcome.org";

export function normaliseWellcome(raw: RawWellcomeScheme): NormalisedOpportunity {
  const status = raw.status.toLowerCase() as string;
  const deadlineDate = raw.deadline ? parseDate(raw.deadline) : null;
  const amount = parseAmount(raw.fundingLevel || null);

  const url = raw.url.startsWith("http")
    ? raw.url
    : `${WELLCOME_BASE}${raw.url}`;

  return {
    funder_slug: "wellcome-trust",
    funder_name: "Wellcome Trust",
    name: raw.title,
    slug: slugify(raw.title),
    status,
    deadline_raw: raw.deadline || null,
    deadline_date: deadlineDate,
    amount_raw: raw.fundingLevel || null,
    amount_min: amount.min,
    amount_max: amount.max,
    amount_currency: amount.currency,
    url,
    funding_type: null,
    description: raw.description || null,
    eligibility: null,
    scope: null,
    source: "wellcome",
    source_metadata: {
      career_stage: raw.careerStage,
      location_requirement: raw.location,
      duration: raw.duration,
      frequency: raw.frequency,
    },
  };
}
