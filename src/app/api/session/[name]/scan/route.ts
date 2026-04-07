import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { GRANT_SCANNER_PROMPT } from "@/lib/prompts/grant-scanner";
import { pipeQueryToSSE, sseResponse } from "@/lib/sse";
import { persistDiscoveredManifest } from "@/lib/scan-persistence";
import { buildScanDbContext } from "@/lib/scan-db-context";
import { getResearcherBySlug, updatePipelineState } from "@/lib/researcher-store";

export async function POST(
  req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  const { name } = params;
  const dataDir = resolve(process.cwd(), "data");

  // Build profile context for smart scan + DB context for self-improvement loop
  let profileContext = "";
  const allowedTools = ["Read", "Write", "Glob", "WebFetch"];

  // Fetch DB-sourced funders to feed back into the agent (closes the loop)
  const dbContext = await buildScanDbContext();

  // Read profile from DB (primary), fall back to file
  const dbResearcher = await getResearcherBySlug(name).catch(() => null);
  const profile = dbResearcher?.enriched_profile ?? (() => {
    // File fallback
    const profilePath = resolve(dataDir, `researchers/${name}/profile.json`);
    if (existsSync(profilePath)) {
      try { return JSON.parse(readFileSync(profilePath, "utf-8")); } catch { return null; }
    }
    return null;
  })();

  if (profile) {
    profileContext = `\n\nResearcher profile provided for smart scan:\n- Disciplinary fields: ${(profile.disciplinary_fields ?? []).join(", ")}\n- Research themes: ${(profile.research_themes ?? []).join(", ")}\n- Geographic focus: ${(profile.geographic_focus ?? []).join(", ")}\n\nUse WebSearch to discover additional grant URLs relevant to these fields.`;
    allowedTools.push("WebSearch");
  }

  const stream = new ReadableStream<string>({
    async start(controller) {
      await pipeQueryToSSE(
        query({
          prompt: `Harvest the funding database. No flags passed.

Mode: HARVEST mode: full harvest of all sources

URL list: ${dataDir}/funding-sources/_urls.md
Template: ${dataDir}/funding-sources/_template.md
Timestamps: ${dataDir}/funding-sources/_last-harvested.json
Funder files directory: ${dataDir}/funding-sources/
Manifest output: ${dataDir}/funding-sources/_discovered.json${profileContext}${dbContext}`,
          options: {
            cwd: dataDir,
            systemPrompt: GRANT_SCANNER_PROMPT,
            allowedTools,
            permissionMode: "acceptEdits",
            maxTurns: 50,
          },
        }),
        controller
      );
      // Persist structured discoveries to Supabase
      const manifestPath = resolve(dataDir, "funding-sources/_discovered.json");
      const discoveryContext: Record<string, unknown> = { researcher: name };
      if (profile) {
        discoveryContext.disciplines = profile.disciplinary_fields;
        discoveryContext.research_themes = profile.research_themes;
      }
      await persistDiscoveredManifest(manifestPath, discoveryContext);

      // Write per-researcher marker so this session's scan is recoverable on refresh
      writeFileSync(
        resolve(dataDir, `researchers/${name}/_scan-complete`),
        new Date().toISOString()
      );

      // Sync scan completion to DB (best-effort)
      try {
        await updatePipelineState(name, 'scan');
      } catch (stateErr) {
        console.error(`[scan] pipeline state sync failed for ${name}:`, stateErr);
      }
    },
  });

  return sseResponse(stream);
}
