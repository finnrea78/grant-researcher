import { requireUser } from "@/lib/auth";
import { getPipelineState, getResearcherFull } from "@/lib/researcher-store";
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

  const [state, researcher, proposals] = await Promise.all([
    getPipelineState(name).catch(() => ({})),
    getResearcherFull(name),
    getProposalsByResearcherSlug(name),
  ]);

  const proposalFilenames = proposals.map(
    (p) => `${p.funder_slug}-${p.scheme_slug}.md`
  );

  return Response.json({
    profile: !!state.profile,
    enrich: !!state.enrich,
    scan: !!state.scan,
    match: !!state.match,
    proposals: proposalFilenames,
    scholarCandidate: researcher?.scholar_candidate ?? null,
  });
}
