import type { NormalisedScheme } from "../types.js";
import type { RawUkriOpportunity } from "../sources/ukri-finder.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";
import { parseDate } from "./parse-dates.js";

const COUNCIL_SLUGS: Record<string, string> = {
  AHRC: "ahrc",
  BBSRC: "bbsrc",
  EPSRC: "epsrc",
  ESRC: "esrc",
  MRC: "mrc",
  NERC: "nerc",
  STFC: "stfc",
  "Innovate UK": "innovate-uk",
  "Research England": "research-england",
};

export function normaliseUkriOpportunity(
  opp: RawUkriOpportunity
): NormalisedScheme {
  const funderSlug = opp.council
    ? COUNCIL_SLUGS[opp.council] ?? slugify(opp.council)
    : "ukri";

  const amount = parseAmount(opp.fundingAmount);
  const deadlineDate = parseDate(opp.closingDate);

  return {
    funder_slug: funderSlug,
    name: opp.title,
    slug: slugify(opp.title),
    status: opp.status ?? "open",
    deadline_raw: opp.closingDate,
    deadline_date: deadlineDate,
    amount_raw: opp.fundingAmount,
    amount_min: amount.min,
    amount_max: amount.max,
    amount_currency: amount.currency,
    duration: null,
    career_stage: null,
    institutional_eligibility: null,
    thematic_priorities: null,
    application_process: null,
    url: opp.url,
    grant_reference: null,
    source: "ukri_funding_finder",
    source_metadata: {
      council_raw: opp.council,
    },
    classifications: [],
  };
}
