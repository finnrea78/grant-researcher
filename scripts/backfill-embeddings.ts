/**
 * Backfill vector embeddings for all opportunities that have embedding = NULL.
 * Run with: npx tsx scripts/backfill-embeddings.ts
 *
 * Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY from .env.local
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Load .env.local from project root
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

async function main() {
  // Fetch all opportunities with no embedding
  const { data: opportunities, error } = await supabase
    .from("opportunities")
    .select("id, name, description, scope, eligibility")
    .is("embedding", null);

  if (error) {
    console.error("Failed to fetch opportunities:", error.message);
    process.exit(1);
  }

  console.log(`Found ${opportunities.length} opportunities without embeddings`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const opp of opportunities) {
    const text = [opp.name, opp.description, opp.scope, opp.eligibility]
      .filter(Boolean)
      .join("\n");

    if (!text) {
      console.log(`  skip  ${opp.id} — no text fields`);
      skipped++;
      continue;
    }

    try {
      const embedding = await embedText(text);
      const { error: updateError } = await supabase
        .from("opportunities")
        .update({ embedding })
        .eq("id", opp.id);

      if (updateError) throw new Error(updateError.message);
      console.log(`  ✓  ${opp.name?.slice(0, 60)}`);
      success++;
    } catch (err) {
      console.error(`  ✗  ${opp.name?.slice(0, 60)}: ${err}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} embedded, ${skipped} skipped (no text), ${failed} failed`);
}

main();
