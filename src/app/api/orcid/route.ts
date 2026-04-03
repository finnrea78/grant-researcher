import type { IntakeData } from "@/lib/types";

// GET /api/orcid?id=0000-0000-0000-0000
export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const orcid = searchParams.get("id");

  if (!orcid || !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid)) {
    return Response.json({ error: "Invalid ORCID format" }, { status: 400 });
  }

  const res = await fetch(`https://pub.orcid.org/v3.0/${orcid}/record`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    return Response.json(
      { error: `ORCID API returned ${res.status}` },
      { status: res.status === 404 ? 404 : 502 }
    );
  }

  const data = await res.json();
  const mapped = extractOrcidFields(orcid, data);
  return Response.json(mapped);
}

// Maps a raw ORCID API record to a partial IntakeData shape.
// Only maps fields that are reliably present and useful for pre-filling the intake form.
function extractOrcidFields(
  orcid: string,
  record: Record<string, unknown>
): Partial<IntakeData> {
  const result: Partial<IntakeData> = {
    identifiers: { orcid },
  };

  // Name
  const person = record["person"] as Record<string, unknown> | undefined;
  if (person) {
    const nameObj = person["name"] as Record<string, unknown> | undefined;
    if (nameObj) {
      const given = (nameObj["given-names"] as Record<string, unknown> | undefined)?.["value"] as string | undefined;
      const family = (nameObj["family-name"] as Record<string, unknown> | undefined)?.["value"] as string | undefined;
      if (given || family) {
        result.name = [given, family].filter(Boolean).join(" ");
      }
    }
  }

  // Most recent employment → institution, department, institution_country
  const activities = record["activities-summary"] as Record<string, unknown> | undefined;
  if (activities) {
    const employmentsWrapper = activities["employments"] as Record<string, unknown> | undefined;
    const affiliationGroups = employmentsWrapper?.["affiliation-group"] as unknown[] | undefined;
    if (Array.isArray(affiliationGroups) && affiliationGroups.length > 0) {
      // Take the first (most recent) employment
      const group = affiliationGroups[0] as Record<string, unknown>;
      const summaries = group["summaries"] as unknown[] | undefined;
      const empSummary = Array.isArray(summaries) && summaries.length > 0
        ? (summaries[0] as Record<string, unknown>)["employment-summary"] as Record<string, unknown> | undefined
        : undefined;

      if (empSummary) {
        const org = empSummary["organization"] as Record<string, unknown> | undefined;
        if (org) {
          result.institution = org["name"] as string | undefined;
          const address = org["address"] as Record<string, unknown> | undefined;
          if (address) {
            result.institution_country = address["country"] as string | undefined;
          }
        }
        result.department = empSummary["department-name"] as string | undefined;
      }
    }

    // Most recent education with "PhD" or "DPhil" in role-title → phd_year
    const educationsWrapper = activities["educations"] as Record<string, unknown> | undefined;
    const eduGroups = educationsWrapper?.["affiliation-group"] as unknown[] | undefined;
    if (Array.isArray(eduGroups)) {
      for (const group of eduGroups) {
        const eduGroup = group as Record<string, unknown>;
        const summaries = eduGroup["summaries"] as unknown[] | undefined;
        const eduSummary = Array.isArray(summaries) && summaries.length > 0
          ? (summaries[0] as Record<string, unknown>)["education-summary"] as Record<string, unknown> | undefined
          : undefined;

        if (eduSummary) {
          const roleTitle = eduSummary["role-title"] as string | undefined;
          if (roleTitle && /phd|dphil|doctorate|doctoral/i.test(roleTitle)) {
            const endDate = eduSummary["end-date"] as Record<string, unknown> | undefined;
            const year = endDate?.["year"] as Record<string, unknown> | undefined;
            const yearValue = year?.["value"] as string | undefined;
            if (yearValue) {
              result.eligibility = {
                ...(result.eligibility ?? {}),
                phd_year: parseInt(yearValue, 10),
              };
            }
            break;
          }
        }
      }
    }
  }

  return result;
}
