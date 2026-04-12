import { query } from "@anthropic-ai/claude-agent-sdk";
import { RESEARCHER_ENRICHER_PROMPT } from "@/lib/prompts/researcher-enricher";
import {
  getResearcherFull,
  upsertResearcher,
  updateResearcherProfile,
  updateProfileEmbedding,
  updateScholarCandidate,
  updatePipelineState,
} from "@/lib/researcher-store";
import { formatSSEEvent, sseResponse } from "@/lib/sse";
import { requireUser } from "@/lib/auth";
import { agentQueue } from "@/lib/concurrency";
import type { IntakeData, ResearcherProfile } from "@/lib/types";

/**
 * Build the injected context block for the enrich agent.
 * All context comes from DB — no file reads needed.
 */
function buildEnrichPrompt(name: string, researcher: {
  name: string;
  enriched_profile: ResearcherProfile | null;
  cv_text: string | null;
}): string {
  const parts: string[] = [`Research and enrich the profile for researcher "${name}".`, ""];

  parts.push("## Current Profile");
  parts.push(researcher.enriched_profile
    ? JSON.stringify(researcher.enriched_profile, null, 2)
    : "No profile yet.");
  parts.push("");

  if (researcher.cv_text) {
    parts.push("## CV Text (for additional context)");
    parts.push(researcher.cv_text);
    parts.push("");
  }

  parts.push(
    "After completing your research (Steps 2–7 from the system prompt), output a JSON object " +
    "(no markdown fences) with exactly these keys:\n" +
    '- "enriched_fields": object with any new fields to merge into the profile (e.g. google_scholar_url, scholar_h_index, retrieval_summary, future_research)\n' +
    '- "scholar_candidate": { "candidate_url": "...", "candidate_confidence": "high"|"medium" } or null\n' +
    '- "context_summary": the researcher-context.md content as a string\n\n' +
    "Do NOT include enriched_fields already in the profile unless you are updating them with verified web data."
  );

  return parts.join("\n");
}

interface EnrichOutput {
  enriched_fields?: Partial<ResearcherProfile>;
  scholar_candidate?: { candidate_url: string; candidate_confidence: string } | null;
  context_summary?: string;
}

function parseEnrichOutput(text: string): EnrichOutput {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

export async function POST(
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
        // Read all context from DB
        const researcher = await getResearcherFull(name);
        if (!researcher) {
          controller.enqueue(formatSSEEvent({ type: "error", message: `Researcher "${name}" not found` }));
          agentQueue.release();
          controller.close();
          return;
        }

        const prompt = buildEnrichPrompt(name, researcher);

        let rawText = "";
        for await (const message of query({
          prompt,
          options: {
            systemPrompt: RESEARCHER_ENRICHER_PROMPT,
            allowedTools: ["WebFetch", "WebSearch"],
            model: "claude-sonnet-4-6",
            maxTurns: 12,
          },
        })) {
          if (message.type === "assistant") {
            for (const block of message.message.content) {
              if (block.type === "tool_use") {
                controller.enqueue(formatSSEEvent({ type: "tool", name: block.name }));
              } else if (block.type === "text" && block.text.trim()) {
                controller.enqueue(formatSSEEvent({ type: "text", text: block.text.trim() }));
                rawText += block.text;
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

        // Parse agent output and write to DB
        const output = parseEnrichOutput(rawText);

        if (output.enriched_fields && researcher.enriched_profile) {
          const merged = { ...researcher.enriched_profile, ...output.enriched_fields };
          await updateResearcherProfile(name, merged as ResearcherProfile);
          if (merged.retrieval_summary) {
            await updateProfileEmbedding(name, merged.retrieval_summary);
          }
        }

        if (output.scholar_candidate) {
          await updateScholarCandidate(name, output.scholar_candidate);
        }

        await updatePipelineState(name, { enrich: true });
      } catch (err) {
        controller.enqueue(formatSSEEvent({ type: "error", message: String(err) }));
      }

      agentQueue.release();
      controller.close();
    },
  });

  return sseResponse(stream);
}

export async function PATCH(
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

  const body = await req.json() as { confirm: boolean; scholar_url?: string };

  if (body.confirm && body.scholar_url) {
    // Merge confirmed Scholar URL into researcher's identifiers
    const researcher = await getResearcherFull(name);
    if (researcher) {
      const intake: IntakeData = {
        name: researcher.name,
        identifiers: {
          ...(researcher.enriched_profile as unknown as IntakeData)?.identifiers,
          google_scholar_url: body.scholar_url,
        },
      };
      await upsertResearcher(intake, name, userId);
    }

    // Clear the pending scholar candidate
    await updateScholarCandidate(name, null);

    return Response.json({ ok: true, action: "confirmed" });
  }

  // User skipped Scholar confirmation — clear candidate, record skip
  await updateScholarCandidate(name, null);
  await updatePipelineState(name, { scholar_skip: true });
  return Response.json({ ok: true, action: "skipped" });
}
