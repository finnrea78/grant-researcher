import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { PROFILE_BUILDER_PROMPT } from "@/lib/prompts/profile-builder";
import { pipeQueryToSSE, sseResponse } from "@/lib/sse";

export async function POST(
  _req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  const { name } = params;
  const dataDir = resolve(process.cwd(), "data");

  const stream = new ReadableStream<string>({
    async start(controller) {
      await pipeQueryToSSE(
        query({
          prompt: `Build a researcher profile for "${name}".

Read intake data from: ${dataDir}/researchers/${name}/intake.json

The CV file may or may not exist. Check for it at: ${dataDir}/researchers/${name}/raw/cv.md
If it exists, use it to supplement the intake data. If it does not exist, build the profile from intake.json alone.

Write outputs to:
- ${dataDir}/researchers/${name}/profile.json
- ${dataDir}/researchers/${name}/publications.md`,
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
    },
  });

  return sseResponse(stream);
}
