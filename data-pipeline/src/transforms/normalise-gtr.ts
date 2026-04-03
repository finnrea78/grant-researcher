import type { GtrProjectOverview, NormalisedScheme, Classification } from "../types.js";
import { slugify } from "./slugify.js";
import { parseAmount } from "./parse-amounts.js";

/** Map UKRI council names to slugs. */
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

function mapStatus(gtrStatus: string): string {
  if (/active/i.test(gtrStatus)) return "active_award";
  return "closed_award";
}

function extractGrantRef(project: GtrProjectOverview["projectComposition"]["project"]): string | null {
  const ids = project.identifiers;
  if (!ids) return null;
  // Handle both array and single identifier shapes from GtR
  const idList = Array.isArray(ids) ? ids : ids.identifier ? [ids.identifier].flat() : [];
  for (const id of idList) {
    const entry = "value" in id ? id : (id as { identifier: { value: string; type: string } }).identifier;
    if (entry && entry.type === "RCUK") return entry.value;
  }
  return null;
}

function extractClassifications(
  data: GtrProjectOverview["projectComposition"]["project"],
  type: string,
  field: "researchSubjects" | "researchTopics" | "healthCategories" | "rcukProgrammes"
): Classification[] {
  const container = data[field];
  if (!container || !container.classification) return [];
  const items = Array.isArray(container.classification) ? container.classification : [container.classification];
  return items
    .filter((c) => c.text)
    .map((c) => ({
      type,
      name: c.text,
      percentage: c.percentage ?? null,
    }));
}

function extractPI(personRoles: GtrProjectOverview["projectComposition"]["personRoles"]): string | null {
  if (!personRoles?.personRole) return null;
  const roles = Array.isArray(personRoles.personRole)
    ? personRoles.personRole
    : [personRoles.personRole];
  for (const pr of roles) {
    const roleList = pr.roles?.role
      ? Array.isArray(pr.roles.role) ? pr.roles.role : [pr.roles.role]
      : [];
    const isPI = roleList.some((r) => r.name === "PRINCIPAL_INVESTIGATOR");
    if (isPI && pr.firstName && pr.surname) {
      return `${pr.firstName} ${pr.surname}`;
    }
  }
  return null;
}

export function normaliseGtrProject(overview: GtrProjectOverview): NormalisedScheme {
  const proj = overview.projectComposition.project;
  const funderName = proj.fund.funder.name;
  const funderSlug = COUNCIL_SLUGS[funderName] ?? slugify(funderName);
  const amount = parseAmount(proj.fund.valuePounds, "GBP");

  const classifications: Classification[] = [
    ...extractClassifications(proj, "research_subject", "researchSubjects"),
    ...extractClassifications(proj, "research_topic", "researchTopics"),
    ...extractClassifications(proj, "health_category", "healthCategories"),
    ...extractClassifications(proj, "rcuk_programme", "rcukProgrammes"),
  ];

  return {
    funder_slug: funderSlug,
    name: proj.title,
    slug: slugify(proj.title),
    status: mapStatus(proj.status),
    deadline_raw: proj.fund.end ?? null,
    deadline_date: proj.fund.end ?? null,
    amount_raw: proj.fund.valuePounds ? `£${proj.fund.valuePounds.toLocaleString()}` : null,
    amount_min: amount.min,
    amount_max: amount.max,
    amount_currency: amount.currency,
    duration: null,
    career_stage: proj.grantCategory ?? null,
    institutional_eligibility: null,
    thematic_priorities: null,
    application_process: null,
    url: null,
    grant_reference: extractGrantRef(proj),
    source: "gtr",
    source_metadata: {
      abstract: proj.abstractText ?? null,
      technical_summary: proj.technicalSummary ?? null,
      impact_text: proj.potentialImpactText ?? null,
      grant_category: proj.grantCategory,
      fund_start: proj.fund.start ?? null,
      fund_type: proj.fund.type ?? null,
      pi_name: extractPI(overview.projectComposition.personRoles),
      lead_organisation: overview.projectComposition.leadResearchOrganisation?.name ?? null,
    },
    classifications,
  };
}
