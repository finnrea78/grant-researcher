import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { requireUser } from "@/lib/auth";
import { parseMatches } from "@/lib/parseMatches";
import { validateMatches } from "@/lib/validateMatches";

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
  const matchesPath = resolve(process.cwd(), `data/outputs/${name}/matches.md`);

  if (!existsSync(matchesPath)) {
    return Response.json({ matches: [] });
  }

  const text = readFileSync(matchesPath, "utf-8");
  return Response.json({ matches: validateMatches(parseMatches(text)) });
}
