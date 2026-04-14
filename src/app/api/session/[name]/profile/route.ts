import { query } from "@anthropic-ai/claude-agent-sdk";
import { PROFILE_BUILDER_PROMPT } from "@/lib/prompts/profile-builder";
import {
  getResearcherFull,
  updateResearcherProfile,
  updatePublicationsMd,
  updatePipelineState,
  updateProfileEmbedding,
} from "@/lib/researcher-store";
import { formatSSEEvent, sseResponse, startHeartbeat } from "@/lib/sse";
import { requireUser } from "@/lib/auth";
import { agentQueue } from "@/lib/concurrency";
import type { IntakeData, ResearcherProfile } from "@/lib/types";

function buildUserPrompt(
  name: string,
  intake: IntakeData | null,
  cvText: string | null,
  proposalIntent: Record<string, unknown> | null
): string {
  const parts: string[] = [`Build a researcher profile for "${name}".`, ""];

  parts.push("## Intake Form Data");
  parts.push(intake ? JSON.stringify(intake, null, 2) : "No intake data provided.");
  parts.push("");

  parts.push("## CV Text");
  parts.push(cvText ?? "No CV uploaded.");
  parts.push("");

  if (proposalIntent) {
    parts.push("## Proposal Intent");
    parts.push(JSON.stringify(proposalIntent, null, 2));
    parts.push("");
  }

  parts.push(
    'Respond with a JSON object (no markdown fences) with exactly two keys:\n' +
    '- "profile": the complete ResearcherProfile JSON following the schema in the system prompt\n' +
    '- "publications_md": the publications.md markdown string following the format in the system prompt\n\n' +
    'If both intake data and CV are available, treat intake fields as ground truth and use the CV only for publications, prior grants, and fields not in the intake.'
  );

  return parts.join("\n");
}

function parseProfileResponse(text: string): { profile: ResearcherProfile; publications_md: string } {
  const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  return JSON.parse(cleaned);
}

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
  const researcher = await getResearcherFull(name, userId);

  if (!researcher?.enriched_profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  return Response.json({ profile: researcher.enriched_profile });
}

export async function POST(
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

  const stream = new ReadableStream<string>({
    async start(controller) {
      const startMs = Date.now();
      try {
        await agentQueue.acquire();
      } catch {
        controller.enqueue(formatSSEEvent({ type: "error", message: "Server busy — too many concurrent requests. Please retry." }));
        controller.close();
        return;
      }
      try {
        const researcher = await getResearcherFull(name, userId);
        const intake: IntakeData | null = researcher
          ? { name: researcher.name, ...(researcher.enriched_profile as IntakeData ?? {}) }
          : null;
        const cvText = researcher?.cv_text ?? null;
        const proposalIntent = (researcher?.proposal_intent as Record<string, unknown>) ?? null;

        const userPrompt = buildUserPrompt(name, intake, cvText, proposalIntent);

        controller.enqueue(formatSSEEvent({ type: "text", text: "Building researcher profile…" }));

        let rawText = "";
        let resultCost = 0;
        let resultTurns = 0;

        const heartbeat = startHeartbeat(controller);
        try {
          for await (const message of query({
            prompt: userPrompt,
            options: {
              systemPrompt: PROFILE_BUILDER_PROMPT,
              allowedTools: [],
              model: "haiku",
              maxTurns: 1,
            },
          })) {
            if (message.type === "assistant") {
              for (const block of message.message.content) {
                if (block.type === "text" && block.text.trim()) {
                  rawText += block.text;
                }
              }
            } else if (message.type === "result" && !message.is_error) {
              if ("total_cost_usd" in message) resultCost = message.total_cost_usd;
              if ("num_turns" in message) resultTurns = message.num_turns;
            }
          }
        } finally {
          clearInterval(heartbeat);
        }

        const { profile, publications_md } = parseProfileResponse(rawText);

        await Promise.all([
          updateResearcherProfile(name, userId, profile),
          updatePublicationsMd(name, userId, publications_md),
          updatePipelineState(name, userId, { profile: true }),
        ]);
        if (profile.retrieval_summary) {
          await updateProfileEmbedding(name, userId, profile.retrieval_summary);
        }

        controller.enqueue(
          formatSSEEvent({ type: "result", turns: resultTurns, cost: resultCost, duration: Date.now() - startMs })
        );
      } catch (err) {
        controller.enqueue(formatSSEEvent({ type: "error", message: String(err) }));
      } finally {
        agentQueue.release();
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
