import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";
import { MATCHER_SCORE_PROMPT } from "@/lib/prompts/matcher";
import { formatSSEEvent, sseResponse, startHeartbeat } from "@/lib/sse";
import { cleanupProposalIntent } from "@/lib/proposalIntent";
import { retrieveCandidates, type CandidateOpportunity } from "@/lib/opportunity-retrieval";
import { requireUser } from "@/lib/auth";
import { agentQueue } from "@/lib/concurrency";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

interface MatchScore {
  opportunity_id?: string;
  name: string;
  funder: string;
  url?: string | null;
  amount?: string | null;
  deadline?: string | null;
  eligible: boolean;
  ineligible_reason?: string | null;
  thematic: number;
  track_record: number;
  strategic: number;
  practical: number;
  overall: number;
  why: string;
  strengths: string;
  weaknesses: string;
  action: string;
  urgent?: boolean;
}

/** Read all score JSON files written by the agent and return sorted results. */
function readScores(scoresDir: string): MatchScore[] {
  try {
    const files = readdirSync(scoresDir).filter(f => f.endsWith(".json"));
    const scores: MatchScore[] = [];
    for (const file of files) {
      try {
        const raw = JSON.parse(readFileSync(resolve(scoresDir, file), "utf-8"));
        scores.push(raw as MatchScore);
      } catch {
        // malformed file — skip
      }
    }
    return scores.sort((a, b) => b.overall - a.overall);
  } catch {
    return [];
  }
}

/** Format the sorted scores into the tiered matches.md markdown. */
function formatMatchesMd(scores: MatchScore[], today: string): string {
  const tier1 = scores.filter(s => s.eligible && s.overall >= 7.0);
  const tier2 = scores.filter(s => s.eligible && s.overall >= 4.0 && s.overall < 7.0);
  const tier3 = scores.filter(s => s.eligible && s.overall > 0 && s.overall < 4.0);
  const notEligible = scores.filter(s => !s.eligible || s.overall === 0);

  const header = `# Grant Matches\n\n> Generated: ${today}\n> Opportunities evaluated: ${scores.length}\n`;

  function formatEntry(s: MatchScore, i: number): string {
    const urgentFlag = s.urgent ? " ⚠️ URGENT" : "";
    return [
      `### ${i + 1}. ${s.name} — ${s.funder}${urgentFlag}`,
      s.opportunity_id ? `<!-- opportunity-id:${s.opportunity_id} -->` : null,
      `- **Overall score:** ${s.overall}/10`,
      `- **Amount:** ${s.amount ?? "unknown"} | **Deadline:** ${s.deadline ?? "unknown"}`,
      s.url ? `- **URL:** ${s.url}` : null,
      `- **Why this matches:** ${s.why}`,
      `- **Key strengths:** ${s.strengths}`,
      `- **Potential weaknesses:** ${s.weaknesses}`,
      `- **Action:** ${s.action}`,
    ].filter(Boolean).join("\n");
  }

  const sections: string[] = [header];

  sections.push("## Tier 1: Strong Matches (score 7.0+)\n");
  if (tier1.length === 0) {
    sections.push("_No strong matches found._\n");
  } else {
    sections.push(tier1.map((s, i) => formatEntry(s, i)).join("\n\n"));
  }

  sections.push("\n## Tier 2: Worth Exploring (score 4.0–6.9)\n");
  if (tier2.length === 0) {
    sections.push("_No tier 2 matches._\n");
  } else {
    sections.push(tier2.map((s, i) => formatEntry(s, i)).join("\n\n"));
  }

  sections.push("\n## Tier 3: Long Shots or Future Opportunities (score 1.0–3.9)\n");
  if (tier3.length > 0) {
    sections.push(tier3.map(s => `- **${s.name} — ${s.funder}:** ${s.overall}/10 — ${s.why}`).join("\n"));
  } else {
    sections.push("_None._");
  }

  sections.push("\n## Not Eligible\n");
  if (notEligible.length > 0) {
    sections.push(notEligible.map(s => `- **${s.name} — ${s.funder}:** ${s.ineligible_reason ?? "ineligible"}`).join("\n"));
  } else {
    sections.push("_All opportunities were eligible._");
  }

  return sections.join("\n");
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
  const dataDir = resolve(process.cwd(), "data");
  const researcherDir = resolve(dataDir, `researchers/${name}`);
  const outputsDir = resolve(dataDir, `outputs/${name}`);
  const scoresDir = resolve(outputsDir, "scores");

  mkdirSync(scoresDir, { recursive: true });

  const profilePath = resolve(researcherDir, "profile.json");
  if (!existsSync(profilePath)) {
    return Response.json({ error: "Researcher profile not found" }, { status: 404 });
  }

  const stream = new ReadableStream<string>({
    async start(controller) {
      const heartbeat = startHeartbeat(controller);

      try {
        // ── Retrieve candidates ────────────────────────────────────────────────
        controller.enqueue(formatSSEEvent({ type: "text", text: "Retrieving matching opportunities from database…" }));

        let candidates: Partial<CandidateOpportunity>[] = [];
        try {
          candidates = await retrieveCandidates(name);
        } catch (err) {
          console.error(`[match] retrieval failed for ${name}:`, err);
          controller.enqueue(formatSSEEvent({ type: "text", text: "Warning: could not retrieve opportunities — results may be limited." }));
        }

        if (candidates.length === 0) {
          controller.enqueue(formatSSEEvent({ type: "error", message: "No matching opportunities found. Try running a scan first." }));
          return;
        }

        // ── Pre-read researcher context ────────────────────────────────────────
        const profileJson = readFileSync(profilePath, "utf-8");
        const contextPath = resolve(researcherDir, "researcher-context.md");
        const contextMd = existsSync(contextPath) ? readFileSync(contextPath, "utf-8") : null;
        const intentPath = resolve(researcherDir, "proposal-intent.json");
        const intentJson = existsSync(intentPath) ? readFileSync(intentPath, "utf-8") : null;
        const today = new Date().toISOString().slice(0, 10);

        controller.enqueue(formatSSEEvent({
          type: "text",
          text: `Found ${candidates.length} opportunities. Scoring now — each match will appear as it's written…`,
        }));

        // ── Acquire agent slot ─────────────────────────────────────────────────
        try {
          await agentQueue.acquire();
        } catch {
          controller.enqueue(formatSSEEvent({ type: "error", message: "Server busy — too many concurrent requests. Please retry." }));
          return;
        }

        // Clean up any stale scores from a previous run
        try {
          for (const f of readdirSync(scoresDir)) rmSync(resolve(scoresDir, f));
        } catch { /* ignore */ }

        // Build score file paths list for the prompt
        const scoreFilePaths = candidates.map((c, i) => {
          const slug = (c.slug as string | undefined) ?? `opportunity-${i + 1}`;
          return `${scoresDir}/${slug}.json`;
        });

        const prompt = `Score each funding opportunity and write one JSON file per opportunity. Today's date is ${today}.

Write scores to these paths (one file per opportunity, in order):
${scoreFilePaths.map((p, i) => `${i + 1}. ${p}`).join("\n")}

<researcher-profile>
${profileJson}
</researcher-profile>
${contextMd ? `\n<researcher-context>\n${contextMd}\n</researcher-context>` : ""}
${intentJson ? `\n<proposal-intent>\n${intentJson}\n</proposal-intent>` : ""}

<opportunities>
${JSON.stringify(candidates, null, 2)}
</opportunities>

Score each opportunity in order and write its JSON file immediately. Do not wait until all are scored.`;

        // ── Run agent — emits tool events as each Write happens ────────────────
        let totalCost = 0;
        let totalTurns = 0;
        let durationMs = 0;

        for await (const message of query({
          prompt,
          options: {
            cwd: dataDir,
            systemPrompt: MATCHER_SCORE_PROMPT,
            allowedTools: ["Write"],
            permissionMode: "acceptEdits",
            maxTurns: candidates.length + 5, // 1 write per candidate + buffer
            model: "claude-sonnet-4-6",
          },
        }) as AsyncIterable<SDKMessage>) {
          if (message.type === "assistant") {
            for (const block of message.message.content) {
              if (block.type === "tool_use" && block.name === "Write") {
                // Extract the filename from the path to show progress
                const filePath = (block.input as { file_path?: string }).file_path ?? "";
                const fileName = filePath.split("/").pop()?.replace(".json", "") ?? "opportunity";
                controller.enqueue(formatSSEEvent({ type: "tool", name: `Scoring: ${fileName}` }));
              }
            }
          } else if (message.type === "result") {
            if (message.is_error) {
              const msg = "errors" in message ? (message.errors as string[]).join("; ") : "Unknown error";
              controller.enqueue(formatSSEEvent({ type: "error", message: msg }));
            } else if ("result" in message) {
              totalCost = message.total_cost_usd;
              totalTurns = message.num_turns;
              durationMs = message.duration_ms;
            }
          }
        }

        // ── Format and write matches.md ────────────────────────────────────────
        const scores = readScores(scoresDir);
        if (scores.length === 0) {
          controller.enqueue(formatSSEEvent({ type: "error", message: "Agent didn't write any score files — matching failed." }));
          return;
        }

        const matchesMd = formatMatchesMd(scores, today);
        const matchesPath = resolve(outputsDir, "matches.md");
        writeFileSync(matchesPath, matchesMd);

        // Emit a summary of the results so the user sees them in the log
        const tier1Count = scores.filter(s => s.eligible && s.overall >= 7.0).length;
        const tier2Count = scores.filter(s => s.eligible && s.overall >= 4.0 && s.overall < 7.0).length;
        controller.enqueue(formatSSEEvent({
          type: "text",
          text: `Scored ${scores.length} opportunities: ${tier1Count} strong match${tier1Count !== 1 ? "es" : ""}, ${tier2Count} worth exploring.`,
        }));

        if (durationMs > 0) {
          controller.enqueue(formatSSEEvent({ type: "result", turns: totalTurns, cost: totalCost, duration: durationMs }));
        }

      } catch (err) {
        controller.enqueue(formatSSEEvent({ type: "error", message: String(err) }));
      } finally {
        // Clean up individual score files
        try {
          for (const f of readdirSync(scoresDir)) rmSync(resolve(scoresDir, f));
          rmSync(scoresDir, { recursive: true });
        } catch { /* ignore */ }

        clearInterval(heartbeat);
        cleanupProposalIntent(researcherDir);
        agentQueue.release();
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
