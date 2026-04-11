import type { ResearcherProfile } from "@/lib/types";

export function formatProfileMarkdown(profile: ResearcherProfile): string {
  const lines: string[] = [];

  lines.push(`# ${profile.name}`);
  lines.push("");

  // About
  const about: string[] = [];
  if (profile.title) about.push(`**Title:** ${profile.title}`);
  if (profile.career_stage) about.push(`**Career Stage:** ${profile.career_stage}`);
  if (profile.institution) {
    about.push(`**Institution:** ${profile.institution}${profile.department ? `, ${profile.department}` : ""}`);
  }
  if (profile.country) about.push(`**Country:** ${profile.country}`);
  if (profile.orcid) about.push(`**ORCID:** ${profile.orcid}`);
  if (profile.google_scholar_url) about.push(`**Google Scholar:** ${profile.google_scholar_url}`);
  if (about.length > 0) {
    lines.push("## About");
    lines.push(...about);
    lines.push("");
  }

  // Scholar stats
  if (profile.scholar_h_index !== undefined || profile.scholar_citation_count !== undefined) {
    lines.push("## Scholar Metrics");
    if (profile.scholar_h_index !== undefined) lines.push(`**h-index:** ${profile.scholar_h_index}`);
    if (profile.scholar_citation_count !== undefined) lines.push(`**Citations:** ${profile.scholar_citation_count}`);
    lines.push("");
  }

  // Eligibility
  if (profile.eligibility) {
    const e = profile.eligibility;
    const elig: string[] = [];
    if (e.employment_type) elig.push(`**Employment:** ${e.employment_type}`);
    if (e.institution_type) elig.push(`**Institution Type:** ${e.institution_type}`);
    if (e.phd_year) elig.push(`**PhD Year:** ${e.phd_year}`);
    if (e.nationality?.length) elig.push(`**Nationality:** ${e.nationality.join(", ")}`);
    if (elig.length > 0) {
      lines.push("## Eligibility");
      lines.push(...elig);
      lines.push("");
    }
  }

  // Research
  const research: string[] = [];
  if (profile.research_themes?.length) research.push(`**Themes:** ${profile.research_themes.join(", ")}`);
  if (profile.research_keywords?.length) research.push(`**Keywords:** ${profile.research_keywords.join(", ")}`);
  if (profile.disciplinary_fields?.length) research.push(`**Disciplines:** ${profile.disciplinary_fields.join(", ")}`);
  if (profile.geographic_focus?.length) research.push(`**Geographic Focus:** ${profile.geographic_focus.join(", ")}`);
  if (research.length > 0) {
    lines.push("## Research");
    lines.push(...research);
    lines.push("");
  }

  // Key Strengths
  if (profile.key_strengths?.length) {
    lines.push("## Key Strengths");
    profile.key_strengths.forEach((s) => lines.push(`- ${s}`));
    lines.push("");
  }

  // Future Research
  if (profile.future_research) {
    lines.push("## Future Research Directions");
    lines.push(profile.future_research);
    lines.push("");
  }

  // Current Projects
  if (profile.current_projects?.length) {
    lines.push("## Current Projects");
    profile.current_projects.forEach((p) => {
      lines.push(`### ${p.title}`);
      lines.push(p.description);
      lines.push("");
    });
  }

  // Publications
  if (profile.publications?.length) {
    lines.push("## Publications");
    profile.publications.forEach((p) => {
      lines.push(`- **${p.title}** (${p.year}) — ${p.journal_or_publisher} [${p.type}]`);
    });
    lines.push("");
  }

  // Prior Grants
  if (profile.prior_grants?.length) {
    lines.push("## Prior Grants");
    profile.prior_grants.forEach((g) => {
      lines.push(
        `- **${g.scheme}** — ${g.funder} (${g.year}), £${g.amount_gbp.toLocaleString()}, ${g.role}`
      );
    });
    lines.push("");
  }

  // PhD Supervision
  if (profile.phd_supervision && (profile.phd_supervision.current > 0 || profile.phd_supervision.completed > 0)) {
    lines.push("## PhD Supervision");
    lines.push(`**Current:** ${profile.phd_supervision.current}  **Completed:** ${profile.phd_supervision.completed}`);
    if (profile.phd_supervision.topics?.length) {
      lines.push(`**Topics:** ${profile.phd_supervision.topics.join(", ")}`);
    }
    lines.push("");
  }

  // External Roles
  if (profile.external_roles?.length) {
    lines.push("## External Roles");
    profile.external_roles.forEach((r) => lines.push(`- ${r}`));
    lines.push("");
  }

  // Potential Gaps
  if (profile.potential_gaps?.length) {
    lines.push("## Potential Gaps");
    profile.potential_gaps.forEach((g) => lines.push(`- ${g}`));
    lines.push("");
  }

  return lines.join("\n");
}
