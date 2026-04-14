import { query } from "@anthropic-ai/claude-agent-sdk";
import { PROPOSAL_OUTLINER_PROMPT } from "@/lib/prompts/proposal-outliner";
import { formatSSEEvent, sseResponse, startHeartbeat } from "@/lib/sse";
import { getResearcherFull } from "@/lib/researcher-store";
import { getOpportunityById, getOpportunityByFunderAndName } from "@/lib/opportunity-store";
import { upsertProposalBySlug } from "@/lib/proposal-store";
import { slugify } from "@/lib/slugify";
import { requireUser } from "@/lib/auth";
import { agentQueue } from "@/lib/concurrency";

export async function POST(
  req: Request,
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
  const { funder: rawFunder, scheme, opportunityId } = (await req.json()) as { funder: string; scheme: string; opportunityId?: string };

  if (!rawFunder || !scheme) {
    return Response.json({ error: "funder and scheme are required" }, { status: 400 });
  }

  const funder = slugify(rawFunder);
  if (!funder) {
    return Response.json({ error: "Invalid funder slug" }, { status: 400 });
  }

  // Fetch opportunity details from DB — prefer direct id lookup, fall back to name-based
  const opportunity = opportunityId
    ? await getOpportunityById(opportunityId)
    : await getOpportunityByFunderAndName(rawFunder, scheme);

  if (!opportunity) {
    return Response.json(
      { error: `Opportunity "${scheme}" from funder "${rawFunder}" not found in database` },
      { status: 404 }
    );
  }

  const schemeSlug = slugify(scheme);

  const opportunityContext = JSON.stringify(opportunity, null, 2);

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
        // Read researcher profile from DB
        const researcher = await getResearcherFull(name, userId);
        const profileJson = researcher?.enriched_profile
          ? JSON.stringify(researcher.enriched_profile, null, 2)
          : "{}";
        const publicationsContext = researcher?.publications_md
          ? `\n\n## Researcher Context\n${researcher.publications_md}`
          : "";

        const prompt = [
          `Draft a strategic alignment document for researcher "${name}" applying to the "${scheme}" scheme from "${opportunity.funder_name ?? rawFunder}".`,
          ``,
          `## Researcher Profile`,
          profileJson,
          publicationsContext,
          ``,
          `## Target Scheme: "${scheme}"`,
          ``,
          `Opportunity details from database:`,
          `<opportunity>`,
          opportunityContext,
          `</opportunity>`,
          ``,
          `Use the opportunity data above as the authoritative source for scheme details (deadline, amount, eligibility, scope). Do NOT search for any external files or URLs.`,
          ``,
          `Output the complete strategic alignment document as text. Do not use any file write tools.`,
        ].filter(Boolean).join("\n");

        let proposalText = "";
        const heartbeat = startHeartbeat(controller);
        try {
          for await (const message of query({
            prompt,
            options: {
              systemPrompt: PROPOSAL_OUTLINER_PROMPT,
              // Read is allowed for profile context; Write is NOT — content is captured from text output
              allowedTools: ["Read"],
              model: "claude-sonnet-4-6",
              maxTurns: 20,
            },
          })) {
            if (message.type === "assistant") {
              for (const block of message.message.content) {
                if (block.type === "tool_use") {
                  controller.enqueue(formatSSEEvent({ type: "tool", name: block.name }));
                } else if (block.type === "text" && block.text.trim()) {
                  controller.enqueue(formatSSEEvent({ type: "text", text: block.text.trim() }));
                  proposalText += block.text;
                }
              }
            } else if (message.type === "result" && !message.is_error) {
              if ("total_cost_usd" in message) {
                controller.enqueue(
                  formatSSEEvent({
                    type: "result",
                    turns: message.num_turns,
                    cost: message.total_cost_usd,
                    duration: "duration_ms" in message ? message.duration_ms : 0,
                  })
                );
              }
            }
          }
        } finally {
          clearInterval(heartbeat);
        }

        // Persist proposal to DB
        if (proposalText.trim()) {
          await upsertProposalBySlug(name, funder, schemeSlug, proposalText);
        }
      } catch (err) {
        controller.enqueue(formatSSEEvent({ type: "error", message: String(err) }));
      }

      agentQueue.release();
      controller.close();
    },
  });

  return sseResponse(stream);
}
