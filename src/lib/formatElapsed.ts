/**
 * Format elapsed seconds as M:SS (e.g. 90 → "1:30").
 */
export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
