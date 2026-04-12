export interface Match {
  id?: string;
  scheme: string;
  funder: string;
  score: number;
  amount: string;
  deadline: string;
  tier: 1 | 2 | 3;
}

export function parseMatches(text: string): Match[] {
  if (!text.trim()) return [];

  const matches: Match[] = [];
  let currentTier: 1 | 2 | 3 = 1;

  const lines = text.split("\n");
  let inNotEligible = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Stop parsing once we hit the Not Eligible section
    if (/^## Not Eligible/.test(line)) { inNotEligible = true; continue; }
    if (inNotEligible) continue;

    // Detect tier changes
    if (/^## Tier 1/.test(line)) { currentTier = 1; continue; }
    if (/^## Tier 2/.test(line)) { currentTier = 2; continue; }
    if (/^## Tier 3/.test(line)) { currentTier = 3; continue; }

    // Match entry heading: ### N. Scheme Name — Funder Name
    const headingMatch = line.match(/^### \d+\.\s+(.+?)\s+—\s+(.+)$/);
    if (!headingMatch) continue;

    const scheme = headingMatch[1].trim();
    const funder = headingMatch[2].trim();

    // Scan following lines for score/amount/deadline (within next 10 lines)
    let score = 0;
    let amount = "";
    let deadline = "";

    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      const detail = lines[j];

      const scoreMatch = detail.match(/\*\*Overall score:\*\*\s*([\d.]+)\/10/);
      if (scoreMatch) score = parseFloat(scoreMatch[1]);

      const amountMatch = detail.match(/\*\*Amount:\*\*\s*([^|]+)/);
      if (amountMatch) amount = amountMatch[1].trim();

      const deadlineMatch = detail.match(/\*\*Deadline:\*\*\s*([^|]+)/);
      if (deadlineMatch) deadline = deadlineMatch[1].trim();

      // Stop at next heading
      if (/^###/.test(detail) && j !== i + 1) break;
    }

    matches.push({ scheme, funder, score, amount, deadline, tier: currentTier });
  }

  return matches;
}
