import { query } from "@anthropic-ai/claude-agent-sdk";
import { MATCHER_PROMPT } from "@/lib/prompts/matcher";
import { formatSSEEvent, sseResponse } from "@/lib/sse";
import { getResearcherFull, updateMatchResultsMd, updatePipelineState } from "@/lib/researcher-store";
import { upsertMatchBatch } from "@/lib/match-store";
import { retrieveCandidates } from "@/lib/opportunity-retrieval";
import { requireUser } from "@/lib/auth";
import { agentQueue } from "@/lib/concurrency";
import type { MatchInput } from "@/lib/match-store";

/**
 * Parse the agent's text output to extract the JSON scores array.
 * Tries to find the first JSON array in the text — agent may output prose before/after.
 */
export function parseAgentScores(rawText: string): Omit<MatchInput, "researcher_id">[] {
  const cleaned = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  // Try direct parse first
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to extraction
  }

  // Extract first JSON array from mixed text
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through
    }
  }

  return [];
}

/**
 * Format parsed match scores as a markdown summary for match_results_md.
 */
export function formatMatchesMd(
  researcherName: string,
  scores: Omit<MatchInput, "researcher_id">[]
): string {
  const date = new Date().toISOString().slice(0, 10);
  const tiers: Record<string, typeof scores> = { strong: [], exploring: [], longshot: [], ineligible: [] };

  for (const s of scores) {
    if (!s.eligible) tiers.ineligible.push(s);
    else if (s.score_overall >= 7) tiers.strong.push(s);
    else if (s.score_overall >= 4) tiers.exploring.push(s);
    else tiers.longshot.push(s);
  }

  const renderScore = (s: Omit<MatchInput, "researcher_id">, i: number): string => {
    const urgent = s.urgent ? " ⚠️ URGENT" : "";
    return [
      `### ${i + 1}. ${s.scheme_slug} — ${s.funder_slug}${urgent}`,
      `- **Overall score:** ${s.score_overall}/10`,
      s.amount_raw ? `- **Amount:** ${s.amount_raw}` : "",
      s.deadline_raw ? `- **Deadline:** ${s.deadline_raw}` : "",
      s.url ? `- **URL:** ${s.url}` : "",
      s.why ? `- **Why this matches:** ${s.why}` : "",
      s.strengths?.length ? `- **Key strengths:** ${s.strengths.join("; ")}` : "",
      s.weaknesses?.length ? `- **Potential weaknesses:** ${s.weaknesses.join("; ")}` : "",
      s.action ? `- **Action:** ${s.action}` : "",
    ].filter(Boolean).join("\n");
  };

  const parts = [
    `# Grant Matches for ${researcherName}`,
    ``,
    `> Generated: ${date}`,
    `> Opportunities evaluated: ${scores.length}`,
    ``,
  ];

  if (tiers.strong.length > 0) {
    parts.push(`## Tier 1: Strong Matches (score 7.0+)`, ``);
    tiers.strong.forEach((s, i) => parts.push(renderScore(s, i), ``));
  }
  if (tiers.exploring.length > 0) {
    parts.push(`## Tier 2: Worth Exploring (score 4.0–6.9)`, ``);
    tiers.exploring.forEach((s, i) => parts.push(renderScore(s, i), ``));
  }
  if (tiers.longshot.length > 0) {
    parts.push(`## Tier 3: Long Shots (score 1.0–3.9)`, ``);
    tiers.longshot.forEach((s, i) => parts.push(renderScore(s, i), ``));
  }
  if (tiers.ineligible.length > 0) {
    parts.push(`## Not Eligible`, ``);
    tiers.ineligible.forEach((s) => {
      parts.push(`- **${s.scheme_slug} — ${s.funder_slug}:** ${s.why ?? "Ineligible"}`);
    });
    parts.push(``);
  }

  return parts.join("\n");
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

  // Retrieve candidates from DB before starting the stream
  let candidatesJson = "[]";
  try {
    const candidates = await retrieveCandidates(name);
    candidatesJson = JSON.stringify(candidates, null, 2);
  } catch (err) {
    console.error(`[match] Failed to retrieve candidates for ${name}:`, err);
  }

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
        // Read researcher context from DB
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
        for await (const message of query({
          prompt,
          options: {
            systemPrompt: MATCHER_PROMPT,
            // NO WebFetch, WebSearch, Read, or Write — all context is injected
            allowedTools: [],
            model: "claude-sonnet-4-6",
            maxTurns: 5,
          },
        })) {
          if (message.type === "assistant") {
            for (const block of message.message.content) {
              if (block.type === "text" && block.text.trim()) {
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

        // Parse scores and persist to DB
        const scores = parseAgentScores(rawText);
        if (scores.length > 0 && researcher) {
          await upsertMatchBatch(researcher.id, scores as MatchInput[]);
        }

        const md = formatMatchesMd(researcher?.name ?? name, scores);
        await updateMatchResultsMd(name, md);

        // Mark match complete; clear proposal_intent (no longer needed)
        await updatePipelineState(name, { match: true, proposal_intent: null });
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
