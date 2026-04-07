import { getResearcherPipelineState } from "@/lib/researcher-store";
import { getProposals } from "@/lib/proposal-store";
import type { ScholarCandidate } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  const { name } = params;

  const [stateResult, proposals] = await Promise.allSettled([
    getResearcherPipelineState(name),
    getProposals(name),
  ]);

  const state = stateResult.status === "fulfilled" ? stateResult.value : null;
  const proposalList = proposals.status === "fulfilled" ? proposals.value : [];

  const pipelineState = state?.pipeline_state ?? {};

  return Response.json({
    profile: pipelineState.profile === true,
    enrich: pipelineState.enrich === true,
    scan: pipelineState.scan === true,
    match: pipelineState.match === true,
    proposals: proposalList.map(
      (p) => `${p.funder_slug}-${p.scheme_slug}.md`
    ),
    scholarCandidate: (state?.scholar_candidate as ScholarCandidate | null) ?? null,
  });
}
