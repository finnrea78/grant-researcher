import { existsSync, readdirSync } from "fs";
import { resolve } from "path";

export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  const { name } = params;
  const dataDir = resolve(process.cwd(), "core/data");

  const profilePath = resolve(dataDir, `researchers/${name}/profile.json`);
  const scanMarkerPath = resolve(dataDir, `researchers/${name}/_scan-complete`);
  const matchesPath = resolve(dataDir, `outputs/${name}/matches.md`);
  const proposalsDir = resolve(dataDir, `outputs/${name}/proposals`);

  const scanComplete = existsSync(scanMarkerPath);

  const proposals = existsSync(proposalsDir)
    ? readdirSync(proposalsDir).filter((f) => f.endsWith(".md"))
    : [];

  return Response.json({
    profile: existsSync(profilePath),
    scan: scanComplete,
    match: existsSync(matchesPath),
    proposals,
  });
}
