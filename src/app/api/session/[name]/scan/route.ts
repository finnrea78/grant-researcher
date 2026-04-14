import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { SCAN_PLANNER_PROMPT } from "@/lib/prompts/scan-planner";
import { extractAll, ScanPlanEntry } from "@/lib/scan-extract";
import { formatSSEEvent, pipeQueryToSSE, sseResponse, startHeartbeat } from "@/lib/sse";
import { persistDiscoveredManifest } from "@/lib/scan-persistence";
import { buildScanDbContext } from "@/lib/scan-db-context";
import { getResearcherFull, updatePipelineState } from "@/lib/researcher-store";
import { requireUser } from "@/lib/auth";
import { agentQueue } from "@/lib/concurrency";

function parseUrlsMd(content: string): ScanPlanEntry[] {
  return content
    .split("\n")
    .filter(line => line.trim() && !line.trim().startsWith("#") && line.includes("|"))
    .map(line => {
      const [slug, url] = line.split("|").map(s => s.trim());
      return { slug, url };
    })
    .filter(e => e.slug && e.url);
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
  const dataDir = resolve(process.cwd(), "data");

  // Fetch DB-sourced funders to feed back into the agent (closes the loop)
  const dbContext = await buildScanDbContext();

  // Read researcher profile from DB for smart scan context injection
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

  const manifestPath = resolve(dataDir, "funding-sources/_discovered.json");

  const stream = new ReadableStream<string>({
    async start(controller) {
      try {
        await agentQueue.acquire();
      } catch {
        controller.enqueue(formatSSEEvent({ type: "error", message: "Server busy — too many concurrent requests. Please retry." }));
        controller.close();
        return;
      }

      let ranPhase2 = false;
      const heartbeat = startHeartbeat(controller);

      try {
        // Phase 1 — Sonnet URL discovery / planning
        const mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }> = {};
        if (profile && process.env.TAVILY_API_KEY) {
          mcpServers["tavily"] = {
            command: "npx",
            args: ["-y", "tavily-mcp"],
            env: { TAVILY_API_KEY: process.env.TAVILY_API_KEY },
          };
        }

        const phase1Prompt = `Plan the grant scan.

URL list: ${dataDir}/funding-sources/_urls.md
Plan output: ${dataDir}/funding-sources/_scan-plan.json${profileContext}${dbContext}`;

        const phase1Tools = ["Read", "Write", "Glob"];
        if (Object.keys(mcpServers).length > 0) {
          // Allow the Tavily MCP search tool (exposed by tavily-mcp as "tavily_search")
          phase1Tools.push("mcp__tavily__tavily_search");
        }

        await pipeQueryToSSE(
          () => query({
            prompt: phase1Prompt,
            options: {
              cwd: dataDir,
              systemPrompt: SCAN_PLANNER_PROMPT,
              allowedTools: phase1Tools,
              permissionMode: "acceptEdits",
              maxTurns: 10,
              ...(Object.keys(mcpServers).length > 0 ? { mcpServers } : {}),
            },
          }),
          controller
        );

        // Handoff — read the plan written by Phase 1
        const planPath = resolve(dataDir, "funding-sources/_scan-plan.json");
        let urls: ScanPlanEntry[];
        try {
          const plan = JSON.parse(readFileSync(planPath, "utf-8"));
          urls = plan.urls ?? [];
        } catch {
          // Fallback: parse _urls.md directly
          try {
            const raw = readFileSync(resolve(dataDir, "funding-sources/_urls.md"), "utf-8");
            urls = parseUrlsMd(raw);
          } catch {
            controller.enqueue(formatSSEEvent({ type: "error", message: "Scan plan unavailable and _urls.md not found — cannot run Phase 2." }));
            urls = [];
          }
        }
        if (urls.length === 0) {
          controller.enqueue(formatSSEEvent({ type: "text", text: "Warning: no URLs found to scan." }));
        } else {
          controller.enqueue(formatSSEEvent({ type: "text", text: `Phase 2: Extracting ${urls.length} funding sources...` }));
          const { results, failed } = await extractAll(urls, controller);

          // Report blocked sites and attempt Tavily recovery
          if (failed.length > 0) {
            const failedList = failed.map(f => f.slug).join(", ");
            controller.enqueue(formatSSEEvent({
              type: "text",
              text: `${failed.length} funder(s) blocked or unreachable: ${failedList}.${profile && process.env.TAVILY_API_KEY ? " Searching for alternative opportunities..." : ""}`,
            }));

            if (profile && process.env.TAVILY_API_KEY && Object.keys(mcpServers).length > 0) {
              const recoveryPrompt = `Recovery: ${failed.length} funder URL(s) were blocked and could not be scraped: ${failedList}.

URL list: ${dataDir}/funding-sources/_urls.md
Plan output: ${dataDir}/funding-sources/_scan-plan.json${profileContext}${dbContext}

Use Tavily to find ${failed.length * 2} alternative grant funding URLs relevant to the researcher profile above.
Prefer funders not already in _urls.md. Append new discoveries to _urls.md and write a fresh _scan-plan.json containing ONLY the newly discovered URLs (not the blocked ones).`;

              await pipeQueryToSSE(
                () => query({
                  prompt: recoveryPrompt,
                  options: {
                    cwd: dataDir,
                    systemPrompt: SCAN_PLANNER_PROMPT,
                    allowedTools: ["Read", "Write", "mcp__tavily__tavily_search"],
                    permissionMode: "acceptEdits",
                    maxTurns: 8,
                    mcpServers,
                  },
                }),
                controller
              );

              // Extract the newly discovered URLs
              try {
                const recoveryPlan = JSON.parse(readFileSync(planPath, "utf-8"));
                const recoveryUrls: ScanPlanEntry[] = recoveryPlan.urls ?? [];
                if (recoveryUrls.length > 0) {
                  controller.enqueue(formatSSEEvent({ type: "text", text: `Extracting ${recoveryUrls.length} replacement sources...` }));
                  const { results: recoveryResults } = await extractAll(recoveryUrls, controller);
                  results.push(...recoveryResults);
                }
              } catch {
                // Recovery plan unreadable — proceed with what we have
              }
            }
          }

          writeFileSync(manifestPath, JSON.stringify(results, null, 2));
          ranPhase2 = true;
        }
      } catch (err) {
        controller.enqueue(formatSSEEvent({ type: "error", message: String(err) }));
      } finally {
        clearInterval(heartbeat);
      }

      // Only persist if this run wrote the manifest — guards against overwriting
      // Supabase with stale data from a previous scan when Phase 1 errored.
      if (ranPhase2) {
        try {
          const discoveryContext: Record<string, unknown> = { researcher: name };
          if (profile) {
            discoveryContext.disciplines = profile.disciplinary_fields;
            discoveryContext.research_themes = profile.research_themes;
          }
          await persistDiscoveredManifest(manifestPath, discoveryContext);

          // Mark scan complete in DB (replaces _scan-complete file marker)
          await updatePipelineState(name, userId, { scan: true });
        } catch (persistErr) {
          console.error(`[scan] persistDiscoveredManifest failed:`, persistErr);
        }
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
