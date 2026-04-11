import { query } from "@anthropic-ai/claude-agent-sdk";
import { AgentSemaphore } from "@/lib/concurrency";
import { formatSSEEvent } from "@/lib/sse";
import { SCAN_EXTRACTOR_PROMPT } from "@/lib/prompts/scan-extractor";

export interface ScanPlanEntry {
  slug: string;
  url: string;
}

// Inline copy of DiscoveredManifestEntry shape — scan-persistence is server-only
// with Supabase imports so we can't import it directly here.
interface DiscoveredManifestEntry {
  funder_slug: string;
  funder_name: string;
  source_url: string;
  disciplines: string[];
  opportunities: Array<{
    name: string;
    slug: string;
    status: string | null;
    deadline_raw: string | null;
    deadline_date: string | null;
    amount_raw: string | null;
    amount_min: number | null;
    amount_max: number | null;
    url: string | null;
    funding_type: string | null;
    description: string | null;
    eligibility: string | null;
    scope: string | null;
  }>;
}

export interface ExtractAllResult {
  results: DiscoveredManifestEntry[];
  failed: ScanPlanEntry[];
}

export async function extractAll(
  urls: ScanPlanEntry[],
  controller: ReadableStreamDefaultController<string>
): Promise<ExtractAllResult> {
  // Local semaphore for Haiku extraction parallelism — intentionally separate from agentQueue
  // (which caps full-agent SDK sessions). Haiku calls are lightweight and fast.
  const semaphore = new AgentSemaphore(5);
  const total = urls.length;
  let completed = 0;
  const startMs = Date.now();

  const settled = await Promise.allSettled(
    urls.map(async ({ slug, url }) => {
      await semaphore.acquire();
      try {
        controller.enqueue(
          formatSSEEvent({ type: "progress", current: completed, total, slug, status: "extracting" })
        );

        let entry: DiscoveredManifestEntry;
        let agentResult: { turns: number; cost: number } = { turns: 0, cost: 0 };
        try {
          ({ entry, agentResult } = await extractSingle(slug, url, controller));
        } catch (err) {
          console.warn(`[scan-extract] Extraction failed for ${slug}:`, err);
          completed++;
          controller.enqueue(
            formatSSEEvent({ type: "progress", current: completed, total, slug, status: "failed" })
          );
          return { slug, url, entry: undefined, agentResult };
        }

        completed++;
        controller.enqueue(
          formatSSEEvent({ type: "progress", current: completed, total, slug, status: "done" })
        );

        return { slug, url, entry, agentResult };
      } finally {
        semaphore.release();
      }
    })
  );

  const results: DiscoveredManifestEntry[] = [];
  const failed: ScanPlanEntry[] = [];
  let totalTurns = 0;
  let totalCost = 0;

  for (const result of settled) {
    if (result.status === "fulfilled" && result.value != null) {
      totalTurns += result.value.agentResult.turns;
      totalCost += result.value.agentResult.cost;
      if (result.value.entry != null) {
        results.push(result.value.entry);
      } else {
        failed.push({ slug: result.value.slug, url: result.value.url });
      }
    }
  }

  controller.enqueue(
    formatSSEEvent({ type: "result", turns: totalTurns, cost: totalCost, duration: Date.now() - startMs })
  );

  return { results, failed };
}

async function extractSingle(
  slug: string,
  url: string,
  controller: ReadableStreamDefaultController<string>
): Promise<{ entry: DiscoveredManifestEntry; agentResult: { turns: number; cost: number } }> {
  let rawText = "";
  let turns = 0;
  let cost = 0;

  for await (const message of query({
    prompt: `Funder slug: ${slug}\nSource URL: ${url}`,
    options: {
      systemPrompt: SCAN_EXTRACTOR_PROMPT,
      allowedTools: ["WebFetch"],
      model: "haiku",
      maxTurns: 5,
      cwd: process.cwd(),
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use") {
          controller.enqueue(formatSSEEvent({ type: "tool", name: `${block.name} [${slug}]` }));
        } else if (block.type === "text") {
          rawText += block.text;
        }
      }
    } else if (message.type === "result" && !message.is_error && "result" in message) {
      turns = message.num_turns;
      cost = message.total_cost_usd;
    }
  }

  const parsed = extractJsonBlock(rawText);
  if (typeof parsed !== "object" || parsed === null || !("funder_slug" in parsed)) {
    throw new Error(`Extractor returned unexpected shape for ${slug}: missing funder_slug`);
  }
  return { entry: parsed as DiscoveredManifestEntry, agentResult: { turns, cost } };
}

export function extractJsonBlock(text: string): unknown {
  const trimmed = text.trim();

  // Try a fenced block first: ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return JSON.parse(fenceMatch[1].trim());

  // Try parsing the whole string as-is (clean single-turn output)
  try {
    return JSON.parse(trimmed);
  } catch {
    // Multi-turn output: Haiku emits reasoning text across turns before the final
    // JSON object. Find the last complete {...} block in the accumulated text.
    const lastBrace = trimmed.lastIndexOf("}");
    if (lastBrace !== -1) {
      const firstBrace = trimmed.indexOf("{");
      if (firstBrace !== -1 && firstBrace < lastBrace) {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      }
    }
    throw new SyntaxError("No JSON object found in extractor response");
  }
}
