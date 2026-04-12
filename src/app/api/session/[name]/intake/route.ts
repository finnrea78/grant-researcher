import { requireUser } from "@/lib/auth";
import { getResearcherFull, upsertResearcher, updatePipelineState } from "@/lib/researcher-store";
import { deleteMatchesForResearcher } from "@/lib/match-store";
import { uploadCv } from "@/lib/cv-store";
import { stripEphemeralFields } from "@/lib/stripEphemeral";
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
  const researcher = await getResearcherFull(name);
  if (!researcher) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Build intake object from DB columns, stripping large/internal fields
  const intake: IntakeData = {
    name: researcher.name,
    ...(researcher.enriched_profile ?? {}),
  };

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

  // Get existing researcher to preserve cv_text if no new CV uploaded
  const existing = await getResearcherFull(name);

  // Handle new CV upload
  let cvBuffer: Buffer | null = null;
  let cvExt = "md";
  if (file && file.size > 0) {
    const originalName = file.name;
    cvExt = originalName.includes(".")
      ? originalName.split(".").pop() ?? "md"
      : "md";
    const bytes = await file.arrayBuffer();
    cvBuffer = Buffer.from(bytes);
    const cvText = await extractCvText(cvBuffer, file.name);
    if (cvText) {
      intake = { ...intake, cv_text: cvText };
    }
  } else if (existing?.cv_text) {
    // Preserve existing cv_text when no new file uploaded
    intake = { ...intake, cv_text: existing.cv_text };
  }

  // Upsert researcher with updated intake data (strips proposal_intent)
  const researcherId = await upsertResearcher(stripEphemeralFields(intake), name, userId);

  // Upload new CV to storage if provided
  if (cvBuffer && file && existing) {
    await uploadCv(researcherId, cvBuffer, file.type || "application/octet-stream", cvExt);
  }

  // Reset pipeline state — re-intake invalidates all downstream stages
  const pipelineStatePatch: Record<string, unknown> = {
    intake: true,
    profile: false,
    enrich: false,
    scan: false,
    match: false,
  };
  if (intake.proposal_intent) {
    pipelineStatePatch.proposal_intent = intake.proposal_intent;
  }
  await updatePipelineState(name, pipelineStatePatch);

  // Delete existing match scores (stale after re-intake)
  if (existing) {
    await deleteMatchesForResearcher(existing.id);
  }

  return Response.json({ ok: true });
}
