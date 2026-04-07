import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import { RESEARCHER_ENRICHER_PROMPT } from "@/lib/prompts/researcher-enricher";
import { supabase } from "@/lib/supabase";
import { updateProfileEmbedding, updateResearcherProfile, updateScholarCandidate, updatePipelineState } from "@/lib/researcher-store";
import { formatSSEEvent, pipeQueryToSSE, sseResponse } from "@/lib/sse";
import type { IntakeData, ResearcherProfile } from "@/lib/types";

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

        // Sync enriched profile to Supabase (best-effort, non-blocking)
        const profilePath = resolve(researcherDir, "profile.json");
        if (existsSync(profilePath)) {
          try {
            const profile = JSON.parse(readFileSync(profilePath, "utf-8")) as ResearcherProfile;
            await updateResearcherProfile(name, profile);
            // Compute and store profile embedding if retrieval_summary was written
            if (profile.retrieval_summary) {
              await updateProfileEmbedding(name, profile.retrieval_summary);
            }
          } catch (syncErr) {
            console.error(`[enrich] Supabase sync failed for ${name}:`, syncErr);
          }
        }
        // Sync enrich pipeline state to DB
        try {
          const enrichPendingPath = resolve(researcherDir, "enrich-pending.json");
          const enrichContextPath = resolve(researcherDir, "researcher-context.md");
          if (existsSync(enrichPendingPath)) {
            // Agent found a Scholar candidate — store it for the UI to confirm
            const candidate = JSON.parse(readFileSync(enrichPendingPath, "utf-8"));
            await updateScholarCandidate(name, candidate);
            // Do NOT set pipeline_state.enrich yet — enrich is pending user confirmation
          } else if (existsSync(enrichContextPath)) {
            // Agent completed enrichment without finding a Scholar candidate
            await updatePipelineState(name, 'enrich');
          }
        } catch (stateErr) {
          console.error(`[enrich] pipeline state sync failed for ${name}:`, stateErr);
        }
      } catch (err) {
        controller.enqueue(formatSSEEvent({ type: "error", message: String(err) }));
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}

export async function PATCH(
  req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
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

    // Update DB: clear scholar candidate, set google_scholar_url, and mark enrich complete
    try {
      await updateScholarCandidate(name, null);
      await supabase.from("researchers").update({ google_scholar_url: body.scholar_url }).eq("slug", name);
      await updatePipelineState(name, 'enrich');
    } catch (err) {
      console.error(`[enrich PATCH confirm] DB sync failed for ${name}:`, err);
    }

    return Response.json({ ok: true, action: "confirmed" });
  }

  // User skipped Scholar confirmation — delete candidate and write skip marker
  const pendingPath = resolve(researcherDir, "enrich-pending.json");
  if (existsSync(pendingPath)) unlinkSync(pendingPath);
  writeFileSync(resolve(researcherDir, "_scholar-skip"), new Date().toISOString());

  try {
    await updateScholarCandidate(name, null);
    await updatePipelineState(name, 'enrich');
  } catch (err) {
    console.error(`[enrich PATCH skip] DB sync failed for ${name}:`, err);
  }

  return Response.json({ ok: true, action: "skipped" });
}
