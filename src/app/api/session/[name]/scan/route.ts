import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { GRANT_SCANNER_PROMPT } from "@/lib/prompts/grant-scanner";
import { pipeQueryToSSE, sseResponse } from "@/lib/sse";

export async function POST(
  req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  const { name } = params;
  const dataDir = resolve(process.cwd(), "data");

  // Build profile context for smart scan
  let profileContext = "";
  const allowedTools = ["Read", "Write", "Glob", "WebFetch"];

  const profilePath = resolve(dataDir, `researchers/${name}/profile.json`);
  if (existsSync(profilePath)) {
    const profile = JSON.parse(readFileSync(profilePath, "utf-8"));
    profileContext = `

Researcher profile provided for smart scan:
- Disciplinary fields: ${(profile.disciplinary_fields ?? []).join(", ")}
- Research themes: ${(profile.research_themes ?? []).join(", ")}
- Geographic focus: ${(profile.geographic_focus ?? []).join(", ")}

Use WebSearch to discover additional grant URLs relevant to these fields.`;
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
Funder files directory: ${dataDir}/funding-sources/${profileContext}`,
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
      // Write per-researcher marker so this session's scan is recoverable on refresh
      writeFileSync(
        resolve(dataDir, `researchers/${name}/_scan-complete`),
        new Date().toISOString()
      );
    },
  });

  return sseResponse(stream);
}
