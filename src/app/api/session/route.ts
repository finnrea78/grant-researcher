import { slugify } from "@/lib/slugify";
import { upsertResearcher, updateOrcidData, updatePipelineState } from "@/lib/researcher-store";
import { uploadCv } from "@/lib/cv-store";
import { extractCvText } from "@/lib/extractCvText";
import { stripEphemeralFields } from "@/lib/stripEphemeral";
import { requireUser } from "@/lib/auth";
import type { IntakeData } from "@/lib/types";

export async function POST(req: Request): Promise<Response> {
  let userId: string;
  try {
    const { user } = await requireUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const formData = await req.formData();
  const file = formData.get("cv") as File | null;
  const rawName = formData.get("name") as string | null;
  const intakeJson = formData.get("intake") as string | null;

  let intake: IntakeData = {};
  if (intakeJson) {
    try {
      intake = JSON.parse(intakeJson) as IntakeData;
    } catch {
      return Response.json({ error: "Invalid intake JSON" }, { status: 400 });
    }
  }

  const nameSource = rawName?.trim() || intake.name?.trim();
  if (!nameSource) {
    return Response.json({ error: "name is required (in FormData or intake.name)" }, { status: 400 });
  }

  const name = slugify(nameSource);
  if (!name) {
    return Response.json({ error: "name must contain alphanumeric characters" }, { status: 400 });
  }

  intake = { ...intake, name: nameSource };

  const intakeForDb = stripEphemeralFields(intake);

  let cvExt = "pdf";
  let bytes: Buffer | null = null;
  if (file && file.size > 0) {
    const originalName = file.name;
    cvExt = originalName.includes(".")
      ? originalName.split(".").pop() ?? "pdf"
      : "pdf";
    bytes = Buffer.from(await file.arrayBuffer());
    const cvText = await extractCvText(bytes, file.name);
    if (cvText) {
      intakeForDb.cv_text = cvText;
    }
  }

  let researcherId: string;
  try {
    researcherId = await upsertResearcher(intakeForDb, name, userId);
  } catch (err) {
    console.error("[session] upsertResearcher failed:", err);
    return Response.json({ error: "Failed to save researcher profile" }, { status: 500 });
  }

  if (bytes && file) {
    try {
      await uploadCv(researcherId, bytes, file.type || "application/octet-stream", cvExt);
    } catch (err) {
      // Storage upload failure is non-fatal — researcher is created, CV text already stored in DB
      console.error("[session] uploadCv failed:", err);
    }
  }

  try {
    await updatePipelineState(name, userId, { intake: true });
  } catch (err) {
    console.error("[session] updatePipelineState failed:", err);
    return Response.json({ error: "Failed to update pipeline state" }, { status: 500 });
  }

  if (intake.identifiers?.orcid) {
    try {
      const orcidRes = await fetch(
        `https://pub.orcid.org/v3.0/${intake.identifiers.orcid}/record`,
        { headers: { Accept: "application/json" } }
      );
      if (orcidRes.ok) {
        const orcidData = await orcidRes.json() as Record<string, unknown>;
        await updateOrcidData(name, userId, orcidData);
      }
    } catch (err) {
      console.error(`[session] ORCID fetch failed:`, err);
    }
  }

  return Response.json({ name });
}
