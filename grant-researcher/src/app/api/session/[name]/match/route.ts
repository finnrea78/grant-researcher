import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { mkdirSync } from "fs";
import { MATCHER_PROMPT } from "grant-scout/prompts/matcher";
import { pipeQueryToSSE, sseResponse } from "@/lib/sse";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
  const { name } = await params;
  const dataDir = resolve(process.cwd(), "core/data");

  // Ensure outputs directory exists
  mkdirSync(resolve(dataDir, `outputs/${name}`), { recursive: true });

  const stream = new ReadableStream<string>({
    async start(controller) {
      await pipeQueryToSSE(
        query({
          prompt: `Score and rank all funding opportunities for researcher "${name}".

Researcher profile: ${dataDir}/researchers/${name}/profile.json
Funding sources directory: ${dataDir}/funding-sources/ (read all *.md files that do NOT start with _)
Write output to: ${dataDir}/outputs/${name}/matches.md

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
    },
  });

  return sseResponse(stream);
}
