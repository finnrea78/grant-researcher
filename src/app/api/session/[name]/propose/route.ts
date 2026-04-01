import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { mkdirSync } from "fs";
import { PROPOSAL_OUTLINER_PROMPT } from "@/lib/prompts/proposal-outliner";
import { pipeQueryToSSE, sseResponse } from "@/lib/sse";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
  const { name } = await params;
  const { funder, scheme } = (await req.json()) as { funder: string; scheme: string };

  if (!funder || !scheme) {
    return Response.json({ error: "funder and scheme are required" }, { status: 400 });
  }

  const dataDir = resolve(process.cwd(), "data");
  const proposalsDir = resolve(dataDir, `outputs/${name}/proposals`);
  mkdirSync(proposalsDir, { recursive: true });

  const schemeSlug = scheme
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const stream = new ReadableStream<string>({
    async start(controller) {
      await pipeQueryToSSE(
        query({
          prompt: `Draft a strategic alignment document for researcher "${name}" applying to the "${scheme}" scheme from "${funder}".

Researcher profile: ${dataDir}/researchers/${name}/profile.json
Funder file: ${dataDir}/funding-sources/${funder}.md
Target scheme: "${scheme}"
Write output to: ${dataDir}/outputs/${name}/proposals/${funder}-${schemeSlug}.md`,
          options: {
            cwd: dataDir,
            systemPrompt: PROPOSAL_OUTLINER_PROMPT,
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
