import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { slugify } from "@/lib/slugify";
import { upsertResearcher } from "@/lib/researcher-store";
import type { IntakeData } from "@/lib/types";

export async function POST(req: Request): Promise<Response> {
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
  if (file && file.size > 0) {
    const originalName = file.name;
    const ext = originalName.includes(".")
      ? originalName.split(".").pop() ?? "md"
      : "md";
    const cvPath = resolve(rawDir, `cv.${ext}`);
    const bytes = await file.arrayBuffer();
    writeFileSync(cvPath, Buffer.from(bytes));
  }

  // Write intake.json to disk (Claude agents read this)
  writeFileSync(resolve(researcherDir, "intake.json"), JSON.stringify(intake, null, 2));

  // Upsert to Supabase
  await upsertResearcher(intake, name);

  return Response.json({ name });
}
