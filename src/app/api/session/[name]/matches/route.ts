import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { parseMatches } from "@/lib/parseMatches";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
  const { name } = await params;
  const matchesPath = resolve(process.cwd(), `data/outputs/${name}/matches.md`);

  if (!existsSync(matchesPath)) {
    return Response.json({ matches: [] });
  }

  const text = readFileSync(matchesPath, "utf-8");
  return Response.json({ matches: parseMatches(text) });
}
