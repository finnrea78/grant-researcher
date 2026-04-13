// data-pipeline/src/commands/cleanup.ts
import { supabase } from "@grant-researcher/db";
import { startRun, completeRun } from "../loaders/log-run.js";
import { embedBackfill } from "./embed-backfill.js";

export async function runPurge(): Promise<{ deleted: number }> {
  console.log("\nPurging closed/expired opportunities");
  const runId = await startRun("purge");

  const today = new Date().toISOString().slice(0, 10);

  const { data: deletedRows, error } = await supabase
    .from("opportunities")
    .delete()
    .or(`status.eq.closed,deadline_date.lt.${today}`)
    .select("id");

  if (error) {
    console.error(`  Failed to purge opportunities: ${error.message}`);
    await completeRun(runId, "failed", { created: 0, updated: 0, skipped: 0 }, error.message);
    return { deleted: 0 };
  }

  const deleted = deletedRows?.length ?? 0;
  console.log(`  Deleted ${deleted} closed/expired opportunities`);
  await completeRun(runId, "success", { created: 0, updated: 0, skipped: deleted });
  return { deleted };
}

export async function runCleanup(): Promise<{ closed: number; embedded: number }> {
  console.log("\nRunning cleanup");
  const runId = await startRun("cleanup");

  const today = new Date().toISOString().slice(0, 10);

  // Close expired opportunities
  const { data: closedRows, error: closeErr } = await supabase
    .from("opportunities")
    .update({ status: "closed" })
    .lt("deadline_date", today)
    .neq("status", "closed")
    .select("id");

  if (closeErr) {
    console.error(`  Failed to close expired opportunities: ${closeErr.message}`);
    await completeRun(runId, "failed", { created: 0, updated: 0, skipped: 0 }, closeErr.message);
    return { closed: 0, embedded: 0 };
  }

  const closed = closedRows?.length ?? 0;
  console.log(`  Closed ${closed} expired opportunities`);

  // Backfill missing embeddings
  const { embedded } = await embedBackfill();
  console.log(`  Embedded ${embedded} opportunities missing embeddings`);

  await completeRun(runId, "success", { created: 0, updated: closed, skipped: 0 });
  return { closed, embedded };
}
