import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { mkdirSync, readFileSync } from "fs";
import { PROPOSAL_OUTLINER_PROMPT } from "@/lib/prompts/proposal-outliner";
import { formatSSEEvent, pipeQueryToSSE, sseResponse } from "@/lib/sse";
import { getOpportunityByFunderAndName } from "@/lib/opportunity-store";
import { requireUser } from "@/lib/auth";
import { upsertProposalBySlug } from "@/lib/proposal-store";
import { agentQueue } from "@/lib/concurrency";

export async function POST(
  req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

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

  const proposalPath = resolve(dataDir, `outputs/${name}/proposals/${funder}-${schemeSlug}.md`);

  const stream = new ReadableStream<string>({
    async start(controller) {
      try {
        await agentQueue.acquire();
      } catch {
        controller.enqueue(formatSSEEvent({ type: "error", message: "Server busy — too many concurrent requests. Please retry." }));
        controller.close();
        return;
      }

      try {
        await pipeQueryToSSE(
          () => query({
            prompt: `Draft a strategic alignment document for researcher "${name}" applying to the "${scheme}" scheme from "${opportunity.funder_name}".

Researcher profile: ${dataDir}/researchers/${name}/profile.json
Target scheme: "${scheme}"
Write output to: ${proposalPath}

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
      } catch (err) {
        controller.enqueue(formatSSEEvent({ type: "error", message: String(err) }));
      }

      // Persist to DB so proposals survive re-login and redeployment
      try {
        const content = readFileSync(proposalPath, "utf-8");
        await upsertProposalBySlug(name, funder, schemeSlug, content);
      } catch {
        // Non-fatal: DB save failure doesn't break the streamed response
      }

      agentQueue.release();
      controller.close();
    },
  });

  return sseResponse(stream);
}
