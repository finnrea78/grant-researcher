import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PROFILE_BUILDER_PROMPT } from "@/lib/prompts/profile-builder";
import { updateResearcherProfile } from "@/lib/researcher-store";
import { formatSSEEvent, pipeQueryToSSE, sseResponse } from "@/lib/sse";
import type { ResearcherProfile } from "@/lib/types";

export async function POST(
  _req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  const { name } = params;
  const dataDir = resolve(process.cwd(), "data");
  const researcherDir = resolve(dataDir, `researchers/${name}`);

  const stream = new ReadableStream<string>({
    async start(controller) {
      try {
        await pipeQueryToSSE(
          query({
            prompt: `Build a researcher profile for "${name}".

Read intake data from: ${researcherDir}/intake.json

The CV file may or may not exist. Check for it at: ${researcherDir}/raw/cv.* (any extension — .md, .pdf, or .txt)
If it exists, use it to supplement the intake data. If it does not exist, build the profile from intake.json alone.

If intake.json contains an orcid_raw field, use it to supplement the profile — particularly employment history (institution, department), education (career stage, PhD year), and works (research themes, keywords).

Write outputs to:
- ${researcherDir}/profile.json
- ${researcherDir}/publications.md`,
            options: {
              cwd: dataDir,
              systemPrompt: PROFILE_BUILDER_PROMPT,
              allowedTools: ["Read", "Write", "Glob"],
              permissionMode: "acceptEdits",
              maxTurns: 20,
            },
          }),
          controller
        );

        // Sync profile to Supabase (best-effort, non-blocking)
        const profilePath = resolve(researcherDir, "profile.json");
        if (existsSync(profilePath)) {
          try {
            const profile = JSON.parse(readFileSync(profilePath, "utf-8")) as ResearcherProfile;
            await updateResearcherProfile(name, profile);
          } catch (syncErr) {
            console.error(`[profile] Supabase sync failed for ${name}:`, syncErr);
          }
        }
      } catch (err) {
        controller.enqueue(formatSSEEvent({ type: "error", message: String(err) }));
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
