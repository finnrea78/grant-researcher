import { query } from "@anthropic-ai/claude-agent-sdk";
import { SCAN_DISCOVERY_PROMPT } from "@/lib/prompts/scan-planner";
import { extractAll, extractJsonBlock, ScanPlanEntry } from "@/lib/scan-extract";
import { formatSSEEvent, safeEnqueue, sseResponse, startHeartbeat } from "@/lib/sse";
import { persistDiscoveredResults } from "@/lib/scan-persistence";
import { buildScanDbContext, getScanUrlList } from "@/lib/scan-db-context";
import { getResearcherFull, updatePipelineState } from "@/lib/researcher-store";
import { requireUser } from "@/lib/auth";
import { agentQueue } from "@/lib/concurrency";

/**
 * Run the Tavily discovery agent and parse its JSON output.
 * Returns discovered URLs or an empty array on failure.
 */
async function runDiscoveryAgent(
  baseUrls: ScanPlanEntry[],
  profileContext: string,
  dbContext: string,
  controller: ReadableStreamDefaultController<string>,
): Promise<ScanPlanEntry[]> {
  const mcpServers = {
    tavily: {
      command: "npx",
      args: ["-y", "tavily-mcp"],
      env: { TAVILY_API_KEY: process.env.TAVILY_API_KEY! },
    },
  };

  const existingJson = JSON.stringify(baseUrls);
  const prompt = `Discover new grant funding URLs.

Existing funders already in the database (for dedup — do NOT include these):
${existingJson}
${profileContext}${dbContext}`;

  let rawText = "";
  for await (const message of query({
    prompt,
    options: {
      systemPrompt: SCAN_DISCOVERY_PROMPT,
      allowedTools: ["mcp__tavily__tavily_search"],
      maxTurns: 8,
      mcpServers,
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use") {
          safeEnqueue(controller, formatSSEEvent({ type: "tool", name: block.name }));
        } else if (block.type === "text") {
          rawText += block.text;
          if (block.text.trim()) {
            safeEnqueue(controller, formatSSEEvent({ type: "text", text: block.text.trim() }));
          }
        }
      }
    } else if (message.type === "result") {
      if (message.is_error) {
        const msg = "errors" in message ? message.errors.join("; ") : "Unknown error";
        safeEnqueue(controller, formatSSEEvent({ type: "error", message: msg }));
      } else if ("result" in message) {
        safeEnqueue(controller, formatSSEEvent({
          type: "result",
          turns: message.num_turns,
          cost: message.total_cost_usd,
          duration: message.duration_ms,
        }));
      }
    }
  }

  try {
    const parsed = extractJsonBlock(rawText) as { discovered?: ScanPlanEntry[] };
    return parsed.discovered ?? [];
  } catch {
    console.warn("[scan] Failed to parse discovery agent output — proceeding without discoveries");
    return [];
  }
}

export async function POST(
  req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  let userId: string;
  try {
    const { user } = await requireUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { name } = params;

  const stream = new ReadableStream<string>({
    async start(controller) {
      try {
        await agentQueue.acquire();
      } catch {
        safeEnqueue(controller, formatSSEEvent({ type: "error", message: "Server busy — too many concurrent requests. Please retry." }));
        controller.close();
        return;
      }

      let ranPhase2 = false;
      const heartbeat = startHeartbeat(controller);

      try {
        // Build URL list from DB (replaces _urls.md file)
        const baseUrls = await getScanUrlList();

        // Read researcher profile from DB for discovery mode
        const researcher = await getResearcherFull(name, userId);
        const profile = researcher?.enriched_profile as Record<string, unknown> | null ?? null;

        let profileContext = "";
        if (profile) {
          profileContext = `

Researcher profile for smart scan:
- Disciplinary fields: ${((profile.disciplinary_fields as string[]) ?? []).join(", ")}
- Research themes: ${((profile.research_themes as string[]) ?? []).join(", ")}
- Geographic focus: ${((profile.geographic_focus as string[]) ?? []).join(", ")}`;
        }

        let urls = [...baseUrls];

        // Discovery mode: use Tavily agent to find new URLs
        if (profile && process.env.TAVILY_API_KEY) {
          const dbContext = await buildScanDbContext();
          safeEnqueue(controller, formatSSEEvent({ type: "text", text: "Phase 1: Discovering new funding sources via Tavily..." }));
          const discovered = await runDiscoveryAgent(baseUrls, profileContext, dbContext, controller);
          if (discovered.length > 0) {
            safeEnqueue(controller, formatSSEEvent({ type: "text", text: `Discovered ${discovered.length} new funding source(s).` }));
            urls.push(...discovered);
          }
        }

        if (urls.length === 0) {
          safeEnqueue(controller, formatSSEEvent({ type: "text", text: "Warning: no URLs found to scan." }));
        } else {
          safeEnqueue(controller, formatSSEEvent({ type: "text", text: `Phase 2: Extracting ${urls.length} funding sources...` }));
          const { results, failed } = await extractAll(urls, controller);

          // Recovery: attempt Tavily discovery for failed URLs
          if (failed.length > 0) {
            const failedList = failed.map(f => f.slug).join(", ");
            safeEnqueue(controller, formatSSEEvent({
              type: "text",
              text: `${failed.length} funder(s) blocked or unreachable: ${failedList}.${profile && process.env.TAVILY_API_KEY ? " Searching for alternatives..." : ""}`,
            }));

            if (profile && process.env.TAVILY_API_KEY) {
              const dbContext = await buildScanDbContext();
              const recoveryPrompt = `Recovery: ${failed.length} funder(s) were blocked: ${failedList}.`;
              const recoveryContext = `${profileContext}${dbContext}

Find ${failed.length * 2} alternative grant funding URLs to replace the blocked ones.`;

              const recovered = await runDiscoveryAgent(
                [...baseUrls, ...urls],
                recoveryContext,
                "",
                controller,
              );

              if (recovered.length > 0) {
                safeEnqueue(controller, formatSSEEvent({ type: "text", text: `Extracting ${recovered.length} replacement sources...` }));
                const { results: recoveryResults } = await extractAll(recovered, controller);
                results.push(...recoveryResults);
              }
            }
          }

          ranPhase2 = true;

          // Persist directly from memory — no intermediate file
          const discoveryContext: Record<string, unknown> = { researcher: name };
          if (profile) {
            discoveryContext.disciplines = profile.disciplinary_fields;
            discoveryContext.research_themes = profile.research_themes;
          }
          await persistDiscoveredResults(results, discoveryContext);
        }

        // Mark scan complete in DB
        await updatePipelineState(name, userId, { scan: true });
      } catch (err) {
        safeEnqueue(controller, formatSSEEvent({ type: "error", message: String(err) }));
      } finally {
        clearInterval(heartbeat);
      }

      agentQueue.release();
      controller.close();
    },
  });

  return sseResponse(stream);
}

/**
 * PATCH — skip the scan stage by writing the completion marker without running the agent.
 * Match can still run against opportunities already in the database.
 */
export async function PATCH(
  _req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  let userId: string;
  try {
    const { user } = await requireUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { name } = params;
  await updatePipelineState(name, userId, { scan: true });
  return Response.json({ ok: true });
}
