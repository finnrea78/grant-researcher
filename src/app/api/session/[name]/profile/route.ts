import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { PROFILE_BUILDER_PROMPT } from "@/lib/prompts/profile-builder";
import { updateResearcherProfile } from "@/lib/researcher-store";
import { formatSSEEvent, sseResponse } from "@/lib/sse";
import type { IntakeData, ResearcherProfile } from "@/lib/types";

const anthropic = new Anthropic();

// Haiku 4.5 pricing ($/M tokens)
const INPUT_COST_PER_M = 0.80;
const OUTPUT_COST_PER_M = 4.00;

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
        // Read intake data
        const intakePath = resolve(researcherDir, "intake.json");
        const intake: IntakeData | null = existsSync(intakePath)
          ? (JSON.parse(readFileSync(intakePath, "utf-8")) as IntakeData)
          : null;

        // Find CV text
        let cvText: string | null = null;
        for (const ext of [".md", ".txt"]) {
          const cvPath = resolve(researcherDir, `raw/cv${ext}`);
          if (existsSync(cvPath)) {
            cvText = readFileSync(cvPath, "utf-8");
            break;
          }
        }

        // Read proposal intent if present
        const intentPath = resolve(researcherDir, "proposal-intent.json");
        const proposalIntent: Record<string, unknown> | null = existsSync(intentPath)
          ? (JSON.parse(readFileSync(intentPath, "utf-8")) as Record<string, unknown>)
          : null;

        const userPrompt = buildUserPrompt(name, intake, cvText, proposalIntent);

        controller.enqueue(formatSSEEvent({ type: "text", text: "Building researcher profile…" }));

        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 8192,
          system: PROFILE_BUILDER_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        });

        const rawText = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");

        const { profile, publications_md } = parseProfileResponse(rawText);

        // Write outputs
        writeFileSync(resolve(researcherDir, "profile.json"), JSON.stringify(profile, null, 2));
        writeFileSync(resolve(researcherDir, "publications.md"), publications_md);

        // Sync to Supabase (best-effort)
        try {
          await updateResearcherProfile(name, profile);
        } catch (syncErr) {
          console.error(`[profile] Supabase sync failed for ${name}:`, syncErr);
        }

        const cost =
          (response.usage.input_tokens / 1_000_000) * INPUT_COST_PER_M +
          (response.usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_M;

        controller.enqueue(
          formatSSEEvent({ type: "result", turns: 1, cost, duration: Date.now() - startMs })
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
