import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import { RESEARCHER_ENRICHER_PROMPT } from "@/lib/prompts/researcher-enricher";
import { updateProfileEmbedding, updateResearcherProfile } from "@/lib/researcher-store";
import { formatSSEEvent, pipeQueryToSSE, sseResponse } from "@/lib/sse";
import { requireUser } from "@/lib/auth";
import { agentQueue } from "@/lib/concurrency";
import type { IntakeData, ResearcherProfile } from "@/lib/types";

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
        await pipeQueryToSSE(
          () => query({
            prompt: `Research and enrich the profile for researcher "${name}".

Read these files:
- Intake data: ${researcherDir}/intake.json
- CV-extracted profile: ${researcherDir}/profile.json

Write outputs to:
- Enriched profile: ${researcherDir}/profile.json (merge new fields only)
- Scholar candidate (if applicable): ${researcherDir}/enrich-pending.json
- Researcher context (completion marker): ${researcherDir}/researcher-context.md`,
            options: {
              cwd: dataDir,
              systemPrompt: RESEARCHER_ENRICHER_PROMPT,
              allowedTools: ["Read", "Write", "Glob", "WebFetch", "WebSearch"],
              permissionMode: "acceptEdits",
              model: "claude-sonnet-4-6",
              maxTurns: 12,
            },
          }),
          controller
        );
      } catch (err) {
        controller.enqueue(formatSSEEvent({ type: "error", message: String(err) }));
      }

      // Sync enriched profile to Supabase (best-effort, non-blocking)
      const profilePath = resolve(researcherDir, "profile.json");
      if (existsSync(profilePath)) {
        try {
          const profile = JSON.parse(readFileSync(profilePath, "utf-8")) as ResearcherProfile;
          await updateResearcherProfile(name, profile);
          if (profile.retrieval_summary) {
            await updateProfileEmbedding(name, profile.retrieval_summary);
          }
        } catch (syncErr) {
          console.error(`[enrich] Supabase sync failed for ${name}:`, syncErr);
        }
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
  const dataDir = resolve(process.cwd(), "data");
  const researcherDir = resolve(dataDir, `researchers/${name}`);

  const body = await req.json() as { confirm: boolean; scholar_url?: string };

  if (body.confirm && body.scholar_url) {
    // Merge confirmed Scholar URL into intake.json
    const intakePath = resolve(researcherDir, "intake.json");
    const intake: IntakeData = existsSync(intakePath)
      ? JSON.parse(readFileSync(intakePath, "utf-8"))
      : {};
    intake.identifiers = { ...intake.identifiers, google_scholar_url: body.scholar_url };
    writeFileSync(intakePath, JSON.stringify(intake, null, 2));

    // Remove the pending marker so the agent won't re-write it
    const pendingPath = resolve(researcherDir, "enrich-pending.json");
    if (existsSync(pendingPath)) unlinkSync(pendingPath);

    return Response.json({ ok: true, action: "confirmed" });
  }

  // User skipped Scholar confirmation — delete candidate and write skip marker
  const pendingPath = resolve(researcherDir, "enrich-pending.json");
  if (existsSync(pendingPath)) unlinkSync(pendingPath);
  writeFileSync(resolve(researcherDir, "_scholar-skip"), new Date().toISOString());
  return Response.json({ ok: true, action: "skipped" });
}
