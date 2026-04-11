import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { SCAN_PLANNER_PROMPT } from "@/lib/prompts/scan-planner";
import { extractAll, ScanPlanEntry } from "@/lib/scan-extract";
import { formatSSEEvent, pipeQueryToSSE, sseResponse } from "@/lib/sse";
import { persistDiscoveredManifest } from "@/lib/scan-persistence";
import { buildScanDbContext } from "@/lib/scan-db-context";
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
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { name } = params;
  const dataDir = resolve(process.cwd(), "data");

  // Fetch DB-sourced funders to feed back into the agent (closes the loop)
  const dbContext = await buildScanDbContext();

  const profilePath = resolve(dataDir, `researchers/${name}/profile.json`);
  const hasProfile = existsSync(profilePath);

  let profileContext = "";
  if (hasProfile) {
    const profile = JSON.parse(readFileSync(profilePath, "utf-8"));
    profileContext = `

Researcher profile for smart scan:
- Disciplinary fields: ${(profile.disciplinary_fields ?? []).join(", ")}
- Research themes: ${(profile.research_themes ?? []).join(", ")}
- Geographic focus: ${(profile.geographic_focus ?? []).join(", ")}`;
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

      try {
        // Phase 1 — Sonnet URL discovery / planning
        const mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }> = {};
        if (hasProfile && process.env.TAVILY_API_KEY) {
          mcpServers["tavily"] = {
            command: "npx",
            args: ["-y", "tavily-mcp"],
            env: { TAVILY_API_KEY: process.env.TAVILY_API_KEY },
          };
        }

        const phase1Prompt = `Plan the grant scan.

URL list: ${dataDir}/funding-sources/_urls.md
Plan output: ${dataDir}/funding-sources/_scan-plan.json${profileContext}${dbContext}`;

        await pipeQueryToSSE(
          () => query({
            prompt: phase1Prompt,
            options: {
              cwd: dataDir,
              systemPrompt: SCAN_PLANNER_PROMPT,
              allowedTools: ["Read", "Write", "Glob"],
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
        }

        // Phase 2 — parallel Haiku extraction
        controller.enqueue(formatSSEEvent({
          type: "text",
          text: `Phase 2: Extracting ${urls.length} funding sources...`,
        }));
        const results = await extractAll(urls, controller);
        writeFileSync(manifestPath, JSON.stringify(results, null, 2));
        ranPhase2 = true;
      } catch (err) {
        controller.enqueue(formatSSEEvent({ type: "error", message: String(err) }));
      }

      // Only persist if this run wrote the manifest — guards against overwriting
      // Supabase with stale data from a previous scan when Phase 1 errored.
      if (ranPhase2) {
        try {
          const discoveryContext: Record<string, unknown> = { researcher: name };
          if (existsSync(profilePath)) {
            const profile = JSON.parse(readFileSync(profilePath, "utf-8"));
            discoveryContext.disciplines = profile.disciplinary_fields;
            discoveryContext.research_themes = profile.research_themes;
          }
          await persistDiscoveredManifest(manifestPath, discoveryContext);

          // Write per-researcher marker so this session's scan is recoverable on refresh
          writeFileSync(
            resolve(dataDir, `researchers/${name}/_scan-complete`),
            new Date().toISOString()
          );
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
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { name } = params;
  const dataDir = resolve(process.cwd(), "data");
  writeFileSync(
    resolve(dataDir, `researchers/${name}/_scan-complete`),
    new Date().toISOString()
  );
  return Response.json({ ok: true });
}
