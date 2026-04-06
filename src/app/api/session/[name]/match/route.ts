import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { mkdirSync } from "fs";
import { MATCHER_PROMPT } from "@/lib/prompts/matcher";
import { pipeQueryToSSE, sseResponse } from "@/lib/sse";
import { cleanupProposalIntent } from "@/lib/proposalIntent";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
  const { name } = await params;
  const dataDir = resolve(process.cwd(), "data");
  const researcherDir = resolve(dataDir, `researchers/${name}`);

  // Ensure outputs directory exists
  mkdirSync(resolve(dataDir, `outputs/${name}`), { recursive: true });

  const stream = new ReadableStream<string>({
    async start(controller) {
      try {
        await pipeQueryToSSE(
          query({
            prompt: `Score and rank all funding opportunities for researcher "${name}".

Researcher profile: ${researcherDir}/profile.json
Funding sources directory: ${dataDir}/funding-sources/ (read all *.md files that do NOT start with _)
Write output to: ${dataDir}/outputs/${name}/matches.md

If a file exists at ${researcherDir}/proposal-intent.json, read it. It describes the researcher's intended proposal (project title, description, target discipline, methodology). Use this to sharpen Thematic Alignment and Strategic Fit scoring.

Remember: make ZERO web calls. All matching is based solely on local files.`,
            options: {
              cwd: dataDir,
              systemPrompt: MATCHER_PROMPT,
              // NO WebFetch or WebSearch — hard constraint
              allowedTools: ["Read", "Write", "Glob"],
              permissionMode: "acceptEdits",
              maxTurns: 30,
            },
          }),
          controller
        );
      } finally {
        // Proposal intent is ephemeral — delete after matching completes
        cleanupProposalIntent(researcherDir);
      }
    },
  });

  return sseResponse(stream);
}
