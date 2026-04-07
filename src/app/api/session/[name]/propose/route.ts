import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { mkdirSync } from "fs";
import { PROPOSAL_OUTLINER_PROMPT } from "@/lib/prompts/proposal-outliner";
import { pipeQueryToSSE, sseResponse } from "@/lib/sse";
import { getOpportunityByFunderAndName } from "@/lib/opportunity-store";

export async function POST(
  req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  const { name } = params;
  const { funder, scheme } = (await req.json()) as { funder: string; scheme: string };

  if (!funder || !scheme) {
    return Response.json({ error: "funder and scheme are required" }, { status: 400 });
  }

  // Fetch opportunity details from DB
  const opportunity = await getOpportunityByFunderAndName(funder, scheme);
  if (!opportunity) {
    return Response.json(
      { error: `Opportunity "${scheme}" from funder "${funder}" not found in database` },
      { status: 404 }
    );
  }

  const dataDir = resolve(process.cwd(), "data");
  const proposalsDir = resolve(dataDir, `outputs/${name}/proposals`);
  mkdirSync(proposalsDir, { recursive: true });

  const schemeSlug = scheme
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const opportunityContext = JSON.stringify(opportunity, null, 2);

  const stream = new ReadableStream<string>({
    async start(controller) {
      await pipeQueryToSSE(
        query({
          prompt: `Draft a strategic alignment document for researcher "${name}" applying to the "${scheme}" scheme from "${opportunity.funder_name}".

Researcher profile: ${dataDir}/researchers/${name}/profile.json
Target scheme: "${scheme}"
Write output to: ${dataDir}/outputs/${name}/proposals/${funder}-${schemeSlug}.md

Opportunity details from database:
<opportunity>
${opportunityContext}
</opportunity>

Use the opportunity data above as the authoritative source for scheme details (deadline, amount, eligibility, scope). Do NOT look for a funder markdown file — all scheme information is provided inline above.`,
          options: {
            cwd: dataDir,
            systemPrompt: PROPOSAL_OUTLINER_PROMPT,
            allowedTools: ["Read", "Write"],
            permissionMode: "acceptEdits",
            maxTurns: 20,
          },
        }),
        controller
      );
    },
  });

  return sseResponse(stream);
}
