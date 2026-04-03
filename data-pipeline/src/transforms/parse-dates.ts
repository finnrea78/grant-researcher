const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

/**
 * Parse a date string into ISO format (YYYY-MM-DD) or null.
 * Handles: "8 May 2026", "8 May 2026, 4pm", "2026-05-08", "January 2027".
 */
export function parseDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = input.trim();
  if (!text || /^(tbc|tba|n\/a|varies|rolling)$/i.test(text)) return null;

  // ISO format already
  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // "DD Month YYYY" with optional trailing text (time, etc.)
  const dayMonthYear = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (dayMonthYear) {
    const month = MONTHS[dayMonthYear[2].toLowerCase()];
    if (month) {
      const day = dayMonthYear[1].padStart(2, "0");
      return `${dayMonthYear[3]}-${month}-${day}`;
    }
  }

  // "Month YYYY" -> first of month
  const monthYear = text.match(/^(\w+)\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase()];
    if (month) return `${monthYear[2]}-${month}-01`;
  }

  return null;
}
