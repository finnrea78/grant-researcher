import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { mkdirSync } from "fs";
import { MATCHER_PROMPT } from "@/lib/prompts/matcher";
import { formatSSEEvent, pipeQueryToSSE, sseResponse, startHeartbeat } from "@/lib/sse";
import { cleanupProposalIntent } from "@/lib/proposalIntent";
import { retrieveCandidates } from "@/lib/opportunity-retrieval";
import { requireUser } from "@/lib/auth";
import { agentQueue } from "@/lib/concurrency";

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
        await agentQueue.acquire();
      } catch {
        controller.enqueue(formatSSEEvent({ type: "error", message: "Server busy — too many concurrent requests. Please retry." }));
        controller.close();
        return;
      }

      const heartbeat = startHeartbeat(controller);
      try {
        await pipeQueryToSSE(
          () => query({
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
      } catch (err) {
        controller.enqueue(formatSSEEvent({ type: "error", message: String(err) }));
      } finally {
        clearInterval(heartbeat);
        cleanupProposalIntent(researcherDir);
        agentQueue.release();
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
