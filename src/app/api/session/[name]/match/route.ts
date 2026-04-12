import { query } from "@anthropic-ai/claude-agent-sdk";
import { MATCHER_PROMPT } from "@/lib/prompts/matcher";
import { formatSSEEvent, sseResponse, startHeartbeat } from "@/lib/sse";
import { getResearcherFull, updateMatchResultsMd, updatePipelineState } from "@/lib/researcher-store";
import { upsertMatchBatch } from "@/lib/match-store";
import { retrieveCandidates } from "@/lib/opportunity-retrieval";
import { parseAgentScores, formatMatchesMd } from "@/lib/match-utils";
import { requireUser } from "@/lib/auth";
import { agentQueue } from "@/lib/concurrency";
import type { MatchInput } from "@/lib/match-store";

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

      const heartbeat = startHeartbeat(controller);

      try {
        controller.enqueue(formatSSEEvent({ type: "text", text: "Retrieving matching opportunities from database…" }));
        let candidatesJson = "[]";
        let candidateCount = 0;
        try {
          const candidates = await retrieveCandidates(name);
          candidateCount = candidates.length;
          candidatesJson = JSON.stringify(candidates, null, 2);
        } catch (err) {
          console.error(`[match] Failed to retrieve candidates for ${name}:`, err);
        }
        controller.enqueue(formatSSEEvent({ type: "text", text: `Found ${candidateCount} opportunities. Scoring now — each match will appear as it is scored…` }));

        const researcher = await getResearcherFull(name);
        const profileJson = researcher?.enriched_profile
          ? JSON.stringify(researcher.enriched_profile, null, 2)
          : "{}";
        const proposalIntent = researcher?.pipeline_state?.proposal_intent ?? null;

        const prompt = [
          `Score and rank funding opportunities for researcher "${name}".`,
          ``,
          `## Researcher Profile`,
          profileJson,
          ``,
          researcher?.publications_md ? `## Researcher Context\n${researcher.publications_md}\n` : "",
          proposalIntent ? `## Proposal Intent\n${JSON.stringify(proposalIntent, null, 2)}\n` : "",
          `Funding opportunities retrieved from database:`,
          `<opportunities>`,
          candidatesJson,
          `</opportunities>`,
          ``,
          `Score each opportunity against the researcher's profile. Output ONLY a JSON array (no markdown fences, no surrounding text) where each element has these fields:`,
          `funder_slug, scheme_slug, score_overall (0-10, 1 decimal), score_thematic, score_track_record, score_strategic, score_practical, eligible (boolean), tier (strong/exploring/longshot/ineligible), why (string), strengths (string[]), weaknesses (string[]), action (string), urgent (boolean), amount_raw (string|null), deadline_raw (string|null), url (string|null)`,
        ].filter(Boolean).join("\n");

        let rawText = "";
        // Incremental JSON object parser: tracks position in rawText already scanned for complete objects
        let scanPos = 0;
        const emittedSlugs = new Set<string>();

        try {
          for await (const message of query({
            prompt,
            options: {
              systemPrompt: MATCHER_PROMPT,
              allowedTools: [],
              model: "claude-sonnet-4-6",
              maxTurns: 5,
            },
          })) {
            if (message.type === "assistant") {
              for (const block of message.message.content) {
                if (block.type === "text") {
                  rawText += block.text;
                  // Extract and emit each completed JSON object as it appears in the stream
                  let i = scanPos;
                  while (i < rawText.length) {
                    if (rawText[i] !== "{") { i++; continue; }
                    // Found an opening brace — find the matching closing brace
                    let depth = 0;
                    let inString = false;
                    let escape = false;
                    let j = i;
                    for (; j < rawText.length; j++) {
                      const ch = rawText[j];
                      if (escape) { escape = false; continue; }
                      if (ch === "\\" && inString) { escape = true; continue; }
                      if (ch === '"') { inString = !inString; continue; }
                      if (inString) continue;
                      if (ch === "{") depth++;
                      else if (ch === "}") { depth--; if (depth === 0) break; }
                    }
                    if (depth !== 0) break; // object not yet complete — wait for more tokens
                    const objText = rawText.slice(i, j + 1);
                    try {
                      const obj = JSON.parse(objText) as Record<string, unknown>;
                      if (typeof obj.scheme_slug === "string") {
                        const slug = obj.scheme_slug;
                        if (!emittedSlugs.has(slug)) {
                          emittedSlugs.add(slug);
                          controller.enqueue(formatSSEEvent({ type: "tool", name: slug }));
                        }
                        controller.enqueue(formatSSEEvent({ type: "match", match: obj }));
                      }
                    } catch {
                      // Not valid JSON — skip past this brace
                    }
                    scanPos = j + 1;
                    i = scanPos;
                  }
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

        const scores = parseAgentScores(rawText);
        if (scores.length > 0 && researcher) {
          await upsertMatchBatch(researcher.id, scores as MatchInput[]);
        }

        const strong = scores.filter((s) => s.eligible && s.score_overall >= 7).length;
        const exploring = scores.filter((s) => s.eligible && s.score_overall >= 4 && s.score_overall < 7).length;
        controller.enqueue(formatSSEEvent({
          type: "text",
          text: `Scored ${scores.length} opportunities: ${strong} strong match${strong !== 1 ? "es" : ""}${exploring ? `, ${exploring} worth exploring` : ""}.`,
        }));

        const md = formatMatchesMd(researcher?.name ?? name, scores);
        await Promise.all([
          updateMatchResultsMd(name, md),
          updatePipelineState(name, { match: true, proposal_intent: null }),
        ]);
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
