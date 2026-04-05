import { extractOrcidFields } from "@/lib/extractOrcidFields";

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
