import { extractOrcidFields } from "@/lib/extractOrcidFields";
import { withRetry } from "@/lib/retry";

// GET /api/orcid?id=0000-0000-0000-0000
export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const orcid = searchParams.get("id");

  if (!orcid || !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid)) {
    return Response.json({ error: "Invalid ORCID format" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await withRetry(
      async () => {
        const r = await fetch(`https://pub.orcid.org/v3.0/${orcid}/record`, {
          headers: { Accept: "application/json" },
        });
        // Throw on retryable statuses so withRetry can catch and retry
        if (r.status === 429 || r.status >= 500) {
          throw Object.assign(new Error(`ORCID API returned ${r.status}`), { status: r.status });
        }
        return r;
      },
      { maxRetries: 2 }
    );
  } catch (err) {
    const status = (err as { status?: number }).status;
    return Response.json(
      { error: `ORCID API error` },
      { status: status === 404 ? 404 : 502 }
    );
  }

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
