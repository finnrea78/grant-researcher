import { requireUser } from "@/lib/auth";
import { getResearcherFull } from "@/lib/researcher-store";
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

  const [researcher, proposalRows] = await Promise.all([
    getResearcherFull(name),
    getProposalsByResearcherSlug(name),
  ]);

  const pipelineState = researcher?.pipeline_state ?? {};
  const proposals = proposalRows.map(
    (p) => `${p.funder_slug}-${p.scheme_slug}.md`
  );

  return Response.json({
    profile: pipelineState.profile === true,
    enrich: pipelineState.enrich === true,
    scan: pipelineState.scan === true,
    match: pipelineState.match === true,
    proposals,
    scholarCandidate: researcher?.scholar_candidate ?? null,
  });
}
