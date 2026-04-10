import type { Match } from "@/lib/parseMatches";

export function validateMatches(matches: Match[], now: Date = new Date()): Match[] {
  return matches.filter((match) => {
    // Score floor — strip anything scored at or below 0
    if (match.score <= 0) return false;

    // Expired deadline — parse the deadline string; if it's a valid past date, strip it
    const parsed = new Date(match.deadline);
    if (!isNaN(parsed.getTime()) && parsed < now) return false;

    return true;
  });
}
