import type { MatchInput } from "@/lib/match-store";

/**
 * Parse the agent's text output to extract the JSON scores array.
 * Tries to find the first JSON array in the text — agent may output prose before/after.
 */
export function parseAgentScores(rawText: string): Omit<MatchInput, "researcher_id">[] {
  const cleaned = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to extraction
  }

  // Extract first JSON array from mixed text
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through
    }
  }

  return [];
}

/**
 * Format parsed match scores as a markdown summary for match_results_md.
 */
export function formatMatchesMd(
  researcherName: string,
  scores: Omit<MatchInput, "researcher_id">[]
): string {
  const date = new Date().toISOString().slice(0, 10);
  const tiers: Record<string, typeof scores> = { strong: [], exploring: [], longshot: [], ineligible: [] };

  for (const s of scores) {
    if (!s.eligible) tiers.ineligible.push(s);
    else if (s.score_overall >= 7) tiers.strong.push(s);
    else if (s.score_overall >= 4) tiers.exploring.push(s);
    else tiers.longshot.push(s);
  }

  const renderScore = (s: Omit<MatchInput, "researcher_id">, i: number): string => {
    const urgent = s.urgent ? " ⚠️ URGENT" : "";
    return [
      `### ${i + 1}. ${s.scheme_slug} — ${s.funder_slug}${urgent}`,
      `- **Overall score:** ${s.score_overall}/10`,
      s.amount_raw ? `- **Amount:** ${s.amount_raw}` : "",
      s.deadline_raw ? `- **Deadline:** ${s.deadline_raw}` : "",
      s.url ? `- **URL:** ${s.url}` : "",
      s.why ? `- **Why this matches:** ${s.why}` : "",
      s.strengths?.length ? `- **Key strengths:** ${s.strengths.join("; ")}` : "",
      s.weaknesses?.length ? `- **Potential weaknesses:** ${s.weaknesses.join("; ")}` : "",
      s.action ? `- **Action:** ${s.action}` : "",
    ].filter(Boolean).join("\n");
  };

  const parts = [
    `# Grant Matches for ${researcherName}`,
    ``,
    `> Generated: ${date}`,
    `> Opportunities evaluated: ${scores.length}`,
    ``,
  ];

  if (tiers.strong.length > 0) {
    parts.push(`## Tier 1: Strong Matches (score 7.0+)`, ``);
    tiers.strong.forEach((s, i) => parts.push(renderScore(s, i), ``));
  }
  if (tiers.exploring.length > 0) {
    parts.push(`## Tier 2: Worth Exploring (score 4.0–6.9)`, ``);
    tiers.exploring.forEach((s, i) => parts.push(renderScore(s, i), ``));
  }
  if (tiers.longshot.length > 0) {
    parts.push(`## Tier 3: Long Shots (score 1.0–3.9)`, ``);
    tiers.longshot.forEach((s, i) => parts.push(renderScore(s, i), ``));
  }
  if (tiers.ineligible.length > 0) {
    parts.push(`## Not Eligible`, ``);
    tiers.ineligible.forEach((s) => {
      parts.push(`- **${s.scheme_slug} — ${s.funder_slug}:** ${s.why ?? "Ineligible"}`);
    });
    parts.push(``);
  }

  return parts.join("\n");
}
