import { getResearcherPipelineState } from "@/lib/researcher-store";
import { parseMatches } from "@/lib/parseMatches";

export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  const { name } = params;

  try {
    const state = await getResearcherPipelineState(name);
    if (!state?.match_results_md) {
      return Response.json({ matches: [] });
    }
    return Response.json({ matches: parseMatches(state.match_results_md) });
  } catch {
    return Response.json({ matches: [] });
  }
}
