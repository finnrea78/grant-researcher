import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import { requireUser } from "@/lib/auth";
import { upsertResearcher } from "@/lib/researcher-store";
import { stripEphemeralFields } from "@/lib/stripEphemeral";
import { writeProposalIntent } from "@/lib/proposalIntent";
import { extractCvText } from "@/lib/extractCvText";
import type { IntakeData } from "@/lib/types";

export async function GET(
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
  const intakePath = resolve(process.cwd(), "data", `researchers/${name}/intake.json`);

  if (!existsSync(intakePath)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const raw = JSON.parse(readFileSync(intakePath, "utf-8")) as IntakeData & {
    cv_text?: unknown;
    orcid_raw?: unknown;
  };

  // Strip large/internal fields before sending to the client
  const { cv_text: _cv, orcid_raw: _orcid, ...intake } = raw;
  void _cv;
  void _orcid;

  return Response.json({ intake });
}

export async function PATCH(
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
  const researcherDir = resolve(dataDir, `researchers/${name}`);
  const rawDir = resolve(researcherDir, "raw");
  const outputDir = resolve(dataDir, `outputs/${name}`);

  const formData = await req.formData();
  const file = formData.get("cv") as File | null;
  const intakeJson = formData.get("intake") as string | null;

  let intake: IntakeData = {};
  if (intakeJson) {
    try {
      intake = JSON.parse(intakeJson) as IntakeData;
    } catch {
      return Response.json({ error: "Invalid intake JSON" }, { status: 400 });
    }
  }

  // Preserve existing cv_text and orcid_raw unless a new CV is uploaded
  const intakePath = resolve(researcherDir, "intake.json");
  let preserved: { cv_text?: string; orcid_raw?: unknown } = {};
  if (existsSync(intakePath)) {
    try {
      const existing = JSON.parse(readFileSync(intakePath, "utf-8")) as Record<string, unknown>;
      if (typeof existing.cv_text === "string") preserved.cv_text = existing.cv_text;
      if (existing.orcid_raw) preserved.orcid_raw = existing.orcid_raw;
    } catch {
      // Ignore parse errors — will proceed without preserved fields
    }
  }

  // Handle new CV upload
  if (file && file.size > 0) {
    const originalName = file.name;
    const cvExt = originalName.includes(".")
      ? originalName.split(".").pop() ?? "md"
      : "md";
    const cvPath = resolve(rawDir, `cv.${cvExt}`);
    const bytes = await file.arrayBuffer();
    writeFileSync(cvPath, Buffer.from(bytes));

    const cvText = await extractCvText(Buffer.from(bytes), file.name);
    if (cvText) {
      preserved.cv_text = cvText;
      if (cvExt !== "md" && cvExt !== "txt") {
        writeFileSync(resolve(rawDir, "cv.md"), cvText);
      }
    } else {
      preserved.cv_text = undefined;
    }
    // New CV means stale orcid_raw is still valid — keep it
  }

  // Merge and write intake.json
  const merged = { ...intake, ...preserved };
  writeFileSync(intakePath, JSON.stringify(merged, null, 2));

  // Write proposal-intent.json
  writeProposalIntent(researcherDir, intake.proposal_intent);

  // Reset pipeline: delete all derived output files
  const filesToDelete = [
    resolve(researcherDir, "profile.json"),
    resolve(researcherDir, "publications.md"),
    resolve(researcherDir, "researcher-context.md"),
    resolve(researcherDir, "_scholar-skip"),
    resolve(researcherDir, "enrich-pending.json"),
    resolve(researcherDir, "_scan-complete"),
    resolve(outputDir, "matches.md"),
  ];
  for (const f of filesToDelete) {
    if (existsSync(f)) unlinkSync(f);
  }
  const proposalsDir = resolve(outputDir, "proposals");
  if (existsSync(proposalsDir)) {
    rmSync(proposalsDir, { recursive: true });
  }

  // Supabase sync (best-effort)
  try {
    await upsertResearcher(stripEphemeralFields(intake), name, userId);
  } catch (err) {
    console.error(`[intake] Supabase upsert failed for ${name}:`, err);
  }

  return Response.json({ ok: true });
}
