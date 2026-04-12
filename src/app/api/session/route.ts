import { slugify } from "@/lib/slugify";
import { upsertResearcher, updateOrcidData, updatePipelineState } from "@/lib/researcher-store";
import { uploadCv } from "@/lib/cv-store";
import { stripEphemeralFields } from "@/lib/stripEphemeral";
import { extractCvText } from "@/lib/extractCvText";
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

  // Parse intake JSON if provided, fall back to empty object
  let intake: IntakeData = {};
  if (intakeJson) {
    try {
      intake = JSON.parse(intakeJson) as IntakeData;
    } catch {
      return Response.json({ error: "Invalid intake JSON" }, { status: 400 });
    }
  }

  // Name can come from FormData or intake object
  const nameSource = rawName?.trim() || intake.name?.trim();
  if (!nameSource) {
    return Response.json({ error: "name is required (in FormData or intake.name)" }, { status: 400 });
  }

  const name = slugify(nameSource);
  if (!name) {
    return Response.json({ error: "name must contain alphanumeric characters" }, { status: 400 });
  }

  // Ensure intake.name is set to the display name
  intake = { ...intake, name: nameSource };

  // Extract CV text if file is provided
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
  }

  // Upsert researcher to DB (strips proposal_intent before writing)
  const researcherId = await upsertResearcher(stripEphemeralFields(intake), name, userId);

  // Upload CV binary to Supabase Storage
  if (cvBuffer && file) {
    await uploadCv(researcherId, cvBuffer, file.type || "application/octet-stream", cvExt);
  }

  // Store pipeline state: intake complete + proposal_intent (ephemeral, not in researchers table)
  const pipelineStatePatch: Record<string, unknown> = { intake: true };
  if (intake.proposal_intent) {
    pipelineStatePatch.proposal_intent = intake.proposal_intent;
  }
  await updatePipelineState(name, pipelineStatePatch);

  // Server-side ORCID fetch if identifier provided
  if (intake.identifiers?.orcid) {
    try {
      const orcidRes = await fetch(
        `https://pub.orcid.org/v3.0/${intake.identifiers.orcid}/record`,
        { headers: { Accept: "application/json" } }
      );
      if (orcidRes.ok) {
        const orcidData = await orcidRes.json() as Record<string, unknown>;
        await updateOrcidData(name, orcidData);
      }
    } catch (err) {
      console.error(`[session] ORCID fetch failed:`, err);
    }
  }

  return Response.json({ name });
}
