import { getProposals } from "@/lib/proposal-store";

export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  const { name } = params;

  try {
    const proposals = await getProposals(name);
    return Response.json({
      proposals: proposals.map((p) => ({
        filename: `${p.funder_slug}-${p.scheme_slug}.md`,
        content: p.content,
      })),
    });
  } catch {
    return Response.json({ proposals: [] });
  }
}
