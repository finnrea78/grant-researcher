import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { slugify } from "@/lib/slugify";
import { upsertResearcher, updateOrcidData } from "@/lib/researcher-store";
import { stripEphemeralFields } from "@/lib/stripEphemeral";
import { writeProposalIntent } from "@/lib/proposalIntent";
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

  // Ensure intake.name is set to the slugified display name
  intake = { ...intake, name: nameSource };

  const dataDir = resolve(process.cwd(), "data");
  const rawDir = resolve(dataDir, `researchers/${name}/raw`);
  const researcherDir = resolve(dataDir, `researchers/${name}`);

  mkdirSync(rawDir, { recursive: true });

  // Write CV file if provided
  let bytes: ArrayBuffer | null = null;
  let cvExt = "md";
  if (file && file.size > 0) {
    const originalName = file.name;
    cvExt = originalName.includes(".")
      ? originalName.split(".").pop() ?? "md"
      : "md";
    const cvPath = resolve(rawDir, `cv.${cvExt}`);
    bytes = await file.arrayBuffer();
    writeFileSync(cvPath, Buffer.from(bytes));
  }

  // Extract CV text for Supabase storage and downstream agents
  if (file && file.size > 0 && bytes !== null) {
    const cvText = await extractCvText(Buffer.from(bytes), file.name);
    if (cvText) {
      intake = { ...intake, cv_text: cvText };
      // Profile builder reads raw/cv.md — write extracted text so non-text uploads work
      if (cvExt !== "md" && cvExt !== "txt") {
        writeFileSync(resolve(rawDir, "cv.md"), cvText);
      }
    }
  }

  // Write intake.json to disk (Claude agents read this)
  writeFileSync(resolve(researcherDir, "intake.json"), JSON.stringify(intake, null, 2));

  // Write proposal-intent.json separately (ephemeral — deleted after matching)
  writeProposalIntent(researcherDir, intake.proposal_intent);

  // Supabase sync — non-critical, pipeline reads from disk
  // Strip proposal_intent: sensitive IP, never persisted to Supabase
  try {
    await upsertResearcher(stripEphemeralFields(intake), name, userId);
  } catch (err) {
    console.error(`[session] Supabase upsert failed for ${name}:`, err);
  }

  // Server-side ORCID fetch if identifier provided
  if (intake.identifiers?.orcid) {
    try {
      const orcidRes = await fetch(
        `https://pub.orcid.org/v3.0/${intake.identifiers.orcid}/record`,
        { headers: { Accept: "application/json" } }
      );
      if (orcidRes.ok) {
        const orcidData = await orcidRes.json() as Record<string, unknown>;
        // Store raw ORCID data in Supabase
        await updateOrcidData(name, orcidData);
        // Merge into intake.json for the profile-builder agent to use
        const intakeWithOrcid = { ...intake, orcid_raw: orcidData };
        writeFileSync(resolve(researcherDir, "intake.json"), JSON.stringify(intakeWithOrcid, null, 2));
      }
    } catch (err) {
      console.error(`[session] ORCID fetch failed:`, err);
    }
  }

  return Response.json({ name });
}
