import { requireUser } from "@/lib/auth";
import { getProposalsByResearcherSlug } from "@/lib/proposal-store";

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
  const rows = await getProposalsByResearcherSlug(name);

  const proposals = rows.map((row) => ({
    filename: `${row.funder_slug}-${row.scheme_slug}.md`,
    content: row.content,
  }));

  return Response.json({ proposals });
}
