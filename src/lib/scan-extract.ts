import { query } from "@anthropic-ai/claude-agent-sdk";
import { AgentSemaphore } from "@/lib/concurrency";
import { scrapeUrl } from "@/lib/firecrawl";
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

export async function extractAll(
  urls: ScanPlanEntry[],
  controller: ReadableStreamDefaultController<string>
): Promise<DiscoveredManifestEntry[]> {
  // Local semaphore for Haiku extraction parallelism — intentionally separate from agentQueue
  // (which caps full-agent SDK sessions). Haiku calls are lightweight and fast.
  const semaphore = new AgentSemaphore(5);
  const total = urls.length;
  let completed = 0;

  const settled = await Promise.allSettled(
    urls.map(async ({ slug, url }) => {
      await semaphore.acquire();
      try {
        // 1. Emit fetching
        controller.enqueue(
          formatSSEEvent({ type: "progress", current: completed, total, slug, status: "fetching" })
        );

        // 2. Fetch page content
        let markdown: string;
        try {
          const result = await scrapeUrl(url);
          markdown = result.markdown;
        } catch {
          completed++;
          controller.enqueue(
            formatSSEEvent({ type: "progress", current: completed, total, slug, status: "failed" })
          );
          return undefined;
        }

        // 3. Emit extracting
        controller.enqueue(
          formatSSEEvent({ type: "progress", current: completed, total, slug, status: "extracting" })
        );

        // 4. Extract structured data via Haiku
        let entry: DiscoveredManifestEntry;
        try {
          entry = await extractSingle(slug, url, markdown);
        } catch {
          completed++;
          controller.enqueue(
            formatSSEEvent({ type: "progress", current: completed, total, slug, status: "failed" })
          );
          return undefined;
        }

        // 5. Emit done
        completed++;
        controller.enqueue(
          formatSSEEvent({ type: "progress", current: completed, total, slug, status: "done" })
        );

        return entry;
      } finally {
        semaphore.release();
      }
    })
  );

  const results: DiscoveredManifestEntry[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value != null) {
      results.push(result.value);
    }
  }
  return results;
}

async function extractSingle(
  slug: string,
  url: string,
  markdown: string
): Promise<DiscoveredManifestEntry> {
  let rawText = "";

  for await (const message of query({
    prompt: `Funder slug: ${slug}\nSource URL: ${url}\n\nPage content:\n${markdown}`,
    options: {
      systemPrompt: SCAN_EXTRACTOR_PROMPT,
      allowedTools: [],
      model: "haiku",
      maxTurns: 1,
      cwd: process.cwd(),
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") rawText += block.text;
      }
    }
  }

  const parsed = extractJsonBlock(rawText);
  if (typeof parsed !== "object" || parsed === null || !("funder_slug" in parsed)) {
    throw new Error(`Haiku returned unexpected shape for ${slug}: missing funder_slug`);
  }
  return parsed as DiscoveredManifestEntry;
}

export function extractJsonBlock(text: string): unknown {
  const trimmed = text.trim();

  // Strip code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/^```(?:json)?\n?([\s\S]*?)\n?```$/);
  const content = fenceMatch ? fenceMatch[1].trim() : trimmed;

  return JSON.parse(content);
}
