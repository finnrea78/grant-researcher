import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { PROFILE_BUILDER_PROMPT } from "@/lib/prompts/profile-builder";
import { getResearcherIntake, updatePublications, updatePipelineState, updateResearcherProfile } from "@/lib/researcher-store";
import { formatSSEEvent, sseResponse } from "@/lib/sse";
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

export async function POST(
  _req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  const { name } = params;
  const dataDir = resolve(process.cwd(), "data");
  const researcherDir = resolve(dataDir, `researchers/${name}`);

  const stream = new ReadableStream<string>({
    async start(controller) {
      const startMs = Date.now();
      try {
        // Read intake data from DB (primary source)
        const dbResearcher = await getResearcherIntake(name).catch(() => null);
        const intake: IntakeData | null = dbResearcher
          ? ({
              name: dbResearcher.name,
              institution: dbResearcher.institution ?? undefined,
              department: dbResearcher.department ?? undefined,
              career_stage: dbResearcher.career_stage as IntakeData["career_stage"] ?? undefined,
              research_themes: dbResearcher.research_themes ?? [],
              research_keywords: dbResearcher.research_keywords ?? [],
              disciplinary_fields: dbResearcher.disciplinary_fields ?? [],
              geographic_focus: dbResearcher.geographic_focus ?? [],
              future_research: dbResearcher.future_research ?? undefined,
              research_trajectory: dbResearcher.research_trajectory ?? undefined,
              funding_goals: dbResearcher.funding_goals as IntakeData["funding_goals"] ?? {},
              collaboration: dbResearcher.collaboration as IntakeData["collaboration"] ?? {},
              eligibility: dbResearcher.eligibility as IntakeData["eligibility"] ?? {},
              cv_text: dbResearcher.cv_text ?? undefined,
            } as IntakeData)
          : null;

        // CV text: prefer DB, fall back to file
        let cvText: string | null = dbResearcher?.cv_text ?? null;
        if (!cvText) {
          for (const ext of [".md", ".txt"]) {
            const cvPath = resolve(researcherDir, `raw/cv${ext}`);
            if (existsSync(cvPath)) {
              cvText = readFileSync(cvPath, "utf-8");
              break;
            }
          }
        }

        // Read proposal intent if present (ephemeral — never persisted to DB)
        const intentPath = resolve(researcherDir, "proposal-intent.json");
        const proposalIntent: Record<string, unknown> | null = existsSync(intentPath)
          ? (JSON.parse(readFileSync(intentPath, "utf-8")) as Record<string, unknown>)
          : null;

        const userPrompt = buildUserPrompt(name, intake, cvText, proposalIntent);

        controller.enqueue(formatSSEEvent({ type: "text", text: "Building researcher profile…" }));

        // Collect the full text response from the agent query
        let rawText = "";
        let resultCost = 0;
        let resultTurns = 0;

        for await (const message of query({
          prompt: userPrompt,
          options: {
            cwd: researcherDir,
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

        const { profile, publications_md } = parseProfileResponse(rawText);

        // Write outputs
        writeFileSync(resolve(researcherDir, "profile.json"), JSON.stringify(profile, null, 2));
        writeFileSync(resolve(researcherDir, "publications.md"), publications_md);

        // Sync to Supabase (best-effort)
        try {
          await updateResearcherProfile(name, profile);
          await updatePublications(name, publications_md);
          await updatePipelineState(name, 'profile');
        } catch (syncErr) {
          console.error(`[profile] Supabase sync failed for ${name}:`, syncErr);
        }

        controller.enqueue(
          formatSSEEvent({ type: "result", turns: resultTurns, cost: resultCost, duration: Date.now() - startMs })
        );
      } catch (err) {
        controller.enqueue(formatSSEEvent({ type: "error", message: String(err) }));
      } finally {
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
