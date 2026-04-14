import { requireUser } from "@/lib/auth";
import { getResearcherFull, upsertResearcher, updatePipelineState } from "@/lib/researcher-store";
import { stripEphemeralFields } from "@/lib/stripEphemeral";
import { deleteMatchesForResearcher } from "@/lib/match-store";
import { uploadCv } from "@/lib/cv-store";
import { extractCvText } from "@/lib/extractCvText";
import type { IntakeData } from "@/lib/types";

export async function GET(
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
  const researcher = await getResearcherFull(name, userId);

  if (!researcher) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const intake = {
    name: researcher.name,
    ...((researcher.enriched_profile ?? {}) as Record<string, unknown>),
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

  let cvText: string | undefined;
  let cvExt = "pdf";
  let bytes: Buffer | null = null;

  if (file && file.size > 0) {
    const originalName = file.name;
    cvExt = originalName.includes(".")
      ? originalName.split(".").pop() ?? "pdf"
      : "pdf";
    bytes = Buffer.from(await file.arrayBuffer());
    cvText = (await extractCvText(bytes, file.name)) ?? undefined;
  } else {
    // No new CV — preserve existing cv_text from DB
    const existing = await getResearcherFull(name, userId);
    cvText = existing?.cv_text ?? undefined;
  }

  const intakeForDb = stripEphemeralFields({ ...intake, name: intake.name || name });
  if (cvText) intakeForDb.cv_text = cvText;

  const researcherId = await upsertResearcher(intakeForDb, name, userId);

  if (bytes && file) {
    await uploadCv(researcherId, bytes, file.type || "application/octet-stream", cvExt);
  }

  // Reset pipeline state — null clears derived stage flags so re-intake triggers re-run
  await updatePipelineState(name, userId, {
    intake: true,
    profile: null,
    enrich: null,
    scan: null,
    match: null,
  });

  await deleteMatchesForResearcher(researcherId);

  return Response.json({ ok: true });
}
