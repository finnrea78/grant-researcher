import { requireUser } from "@/lib/auth";
import { getResearcherBySlug } from "@/lib/researcher-store";
import { getMatches } from "@/lib/match-store";

export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  let userId: string;
  try {
    const { user } = await requireUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { name } = params;
  const researcher = await getResearcherBySlug(name, userId);

  if (!researcher) {
    return Response.json({ error: "Researcher not found" }, { status: 404 });
  }

  const matches = await getMatches(researcher.id);
  return Response.json({ matches });
}
