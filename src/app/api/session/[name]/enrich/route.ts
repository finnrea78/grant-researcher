import { query } from "@anthropic-ai/claude-agent-sdk";
import { RESEARCHER_ENRICHER_PROMPT } from "@/lib/prompts/researcher-enricher";
import {
  getResearcherFull,
  updateResearcherProfile,
  updateProfileEmbedding,
  updateScholarCandidate,
  updatePipelineState,
} from "@/lib/researcher-store";
import { formatSSEEvent, sseResponse, startHeartbeat } from "@/lib/sse";
import { requireUser } from "@/lib/auth";
import { agentQueue } from "@/lib/concurrency";
import type { ResearcherProfile } from "@/lib/types";

async function callHaiku(prompt: string): Promise<string> {
  let text = "";
  for await (const message of query({
    prompt,
    options: {
      model: "claude-haiku-4-5-20251001",
      maxTurns: 1,
      allowedTools: [],
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") text += block.text;
      }
    }
  }
  return text;
}

function buildEnrichPrompt(name: string, profile: ResearcherProfile | null, publicationsMd: string | null): string {
  return [
    `Research and enrich the profile for researcher "${name}".`,
    ``,
    `## Current Profile (from database)`,
    profile ? JSON.stringify(profile, null, 2) : "No profile available.",
    ``,
    publicationsMd ? `## Publications Context\n${publicationsMd}\n` : "",
    `## Output Format`,
    ``,
    `All context is provided above — do NOT read any local files.`,
    `Output a single JSON object (no markdown fences) with these keys:`,
    `- "enriched_fields": object with fields to merge into the profile (e.g. google_scholar_url, scholar_h_index, scholar_citation_count, recent_publications_web). Do NOT include retrieval_summary — it is generated separately.`,
    `- "scholar_candidate": object { candidate_url, candidate_confidence } if a candidate Scholar profile was found but not yet confirmed, or null if confirmed/not found`,
    `- "researcher_context_md": the researcher-context.md content as a string`,
    ``,
    `Do NOT write any files. Return only the JSON object above.`,
  ].filter(Boolean).join("\n");
}

interface EnrichOutput {
  enriched_fields?: Partial<ResearcherProfile>;
  scholar_candidate?: { candidate_url: string; candidate_confidence: string } | null;
  researcher_context_md?: string;
}

function parseEnrichOutput(rawText: string): EnrichOutput {
  const cleaned = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  try {
    return JSON.parse(cleaned) as EnrichOutput;
  } catch {
    // Try to extract JSON from mixed text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as EnrichOutput;
      } catch {
        // Fall through
      }
    }
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
        const researcher = await getResearcherFull(name);
        if (!researcher) {
          controller.enqueue(formatSSEEvent({ type: "error", message: `Researcher "${name}" not found` }));
          agentQueue.release();
          controller.close();
          return;
        }

        const profile = researcher.enriched_profile as ResearcherProfile | null;
        const publicationsMd = researcher.publications_md;
        const prompt = buildEnrichPrompt(name, profile, publicationsMd);

        let rawText = "";
        const heartbeat = startHeartbeat(controller);
        try {
          for await (const message of query({
            prompt,
            options: {
              systemPrompt: RESEARCHER_ENRICHER_PROMPT,
              allowedTools: ["WebFetch", "WebSearch"],
              model: "claude-haiku-4-5-20251001",
              maxTurns: 5,
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
        } finally {
          clearInterval(heartbeat);
        }

        const output = parseEnrichOutput(rawText);

        // Generate retrieval_summary via Haiku (cost-optimised)
        controller.enqueue(formatSSEEvent({ type: "tool", name: "generating-retrieval-summary" }));

        const mergedProfile = { ...(profile ?? {}), ...(output.enriched_fields ?? {}) };
        const haikuInput = [
          `Generate a retrieval_summary for this researcher — ~400 words, third-person present tense, natural prose surfacing implicit research affinities for semantic grant matching.\n\nProfile:\n${JSON.stringify(mergedProfile, null, 2)}`,
          output.researcher_context_md ? `\nResearcher Context:\n${output.researcher_context_md}` : "",
        ].join("");

        let retrievalSummary: string | null = null;
        try {
          retrievalSummary = await callHaiku(haikuInput);
        } catch {
          await new Promise(r => setTimeout(r, 1000));
          try {
            retrievalSummary = await callHaiku(haikuInput);
          } catch (err) {
            controller.enqueue(formatSSEEvent({ type: "error", message: `retrieval_summary generation failed: ${String(err)}` }));
            agentQueue.release();
            controller.close();
            return;
          }
        }

        const updatedProfile = {
          ...mergedProfile,
          ...(retrievalSummary ? { retrieval_summary: retrievalSummary } : {}),
        } as ResearcherProfile;
        await updateResearcherProfile(name, updatedProfile);
        if (updatedProfile.retrieval_summary) {
          await updateProfileEmbedding(name, updatedProfile.retrieval_summary);
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
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { name } = params;
  const body = await req.json() as { confirm: boolean; scholar_url?: string };

  if (body.confirm && body.scholar_url) {
    const researcher = await getResearcherFull(name);
    if (!researcher) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const updatedProfile = {
      ...(researcher.enriched_profile as ResearcherProfile ?? {}),
      google_scholar_url: body.scholar_url,
    };
    await Promise.all([
      updateResearcherProfile(name, updatedProfile as ResearcherProfile),
      updateScholarCandidate(name, null),
    ]);

    return Response.json({ ok: true, action: "confirmed" });
  }

  // User skipped Scholar confirmation — clear candidate, mark skip
  await updateScholarCandidate(name, null);
  await updatePipelineState(name, { scholar_skip: true });
  return Response.json({ ok: true, action: "skipped" });
}
