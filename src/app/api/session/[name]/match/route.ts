import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { mkdirSync, existsSync, readFileSync } from "fs";
import { MATCHER_PROMPT } from "@/lib/prompts/matcher";
import { pipeQueryToSSE, sseResponse } from "@/lib/sse";
import { cleanupProposalIntent } from "@/lib/proposalIntent";
import { retrieveCandidates } from "@/lib/opportunity-retrieval";
import { updateMatchResults, updatePipelineState } from "@/lib/researcher-store";

export async function POST(
  _req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  const { name } = params;
  const dataDir = resolve(process.cwd(), "data");
  const researcherDir = resolve(dataDir, `researchers/${name}`);

  // Ensure outputs directory exists
  mkdirSync(resolve(dataDir, `outputs/${name}`), { recursive: true });

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
        await pipeQueryToSSE(
          query({
            prompt: `Score and rank funding opportunities for researcher "${name}".

Researcher profile: ${researcherDir}/profile.json
Proposal intent (optional): ${researcherDir}/proposal-intent.json
Write output to: ${dataDir}/outputs/${name}/matches.md

Funding opportunities retrieved from database:
<opportunities>
${candidatesJson}
</opportunities>

Score each opportunity against the researcher's profile. Use the researcher-context.md file if it exists alongside profile.json.`,
            options: {
              cwd: dataDir,
              systemPrompt: MATCHER_PROMPT,
              // NO WebFetch, WebSearch, or Glob — candidates are in context
              allowedTools: ["Read", "Write"],
              permissionMode: "acceptEdits",
              maxTurns: 30,
            },
          }),
          controller
        );
      } finally {
        cleanupProposalIntent(researcherDir);
        // Sync match results to DB (best-effort)
        try {
          const matchesPath = resolve(dataDir, `outputs/${name}/matches.md`);
          if (existsSync(matchesPath)) {
            const matchesMd = readFileSync(matchesPath, "utf-8");
            await updateMatchResults(name, matchesMd);
            await updatePipelineState(name, 'match');
          }
        } catch (syncErr) {
          console.error(`[match] DB sync failed for ${name}:`, syncErr);
        }
      }
    },
  });

  return sseResponse(stream);
}
