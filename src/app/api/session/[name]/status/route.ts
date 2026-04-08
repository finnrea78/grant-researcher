import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { requireUser } from "@/lib/auth";
import type { ScholarCandidate } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { name } = params;
  const dataDir = resolve(process.cwd(), "data");

  const profilePath = resolve(dataDir, `researchers/${name}/profile.json`);
  const enrichPath = resolve(dataDir, `researchers/${name}/researcher-context.md`);
  const enrichSkipPath = resolve(dataDir, `researchers/${name}/_scholar-skip`);
  const enrichPendingPath = resolve(dataDir, `researchers/${name}/enrich-pending.json`);
  const scanMarkerPath = resolve(dataDir, `researchers/${name}/_scan-complete`);
  const matchesPath = resolve(dataDir, `outputs/${name}/matches.md`);
  const proposalsDir = resolve(dataDir, `outputs/${name}/proposals`);

  const enrichComplete = existsSync(enrichPath) || existsSync(enrichSkipPath);

  let scholarCandidate: ScholarCandidate | null = null;
  if (existsSync(enrichPendingPath)) {
    try {
      scholarCandidate = JSON.parse(readFileSync(enrichPendingPath, "utf-8"));
    } catch {
      // Ignore malformed pending file
    }
  }

  const proposals = existsSync(proposalsDir)
    ? readdirSync(proposalsDir).filter((f) => f.endsWith(".md"))
    : [];

  return Response.json({
    profile: existsSync(profilePath),
    enrich: enrichComplete,
    scan: existsSync(scanMarkerPath),
    match: existsSync(matchesPath),
    proposals,
    scholarCandidate,
  });
}
