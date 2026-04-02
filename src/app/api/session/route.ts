import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { slugify } from "@/lib/slugify";
import type { IntakeData } from "@/lib/types";

export async function POST(req: Request): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get("cv") as File | null;
  const rawName = formData.get("name") as string | null;

  if (!file || !rawName) {
    return Response.json({ error: "cv and name are required" }, { status: 400 });
  }

  const name = slugify(rawName);
  if (!name) {
    return Response.json({ error: "name must contain alphanumeric characters" }, { status: 400 });
  }

  const dataDir = resolve(process.cwd(), "data");
  const rawDir = resolve(dataDir, `researchers/${name}/raw`);
  const researcherDir = resolve(dataDir, `researchers/${name}`);

  mkdirSync(rawDir, { recursive: true });

  // Determine file extension
  const originalName = file.name;
  const ext = originalName.includes(".")
    ? originalName.split(".").pop() ?? "md"
    : "md";

  const cvPath = resolve(rawDir, `cv.${ext}`);
  const bytes = await file.arrayBuffer();
  writeFileSync(cvPath, Buffer.from(bytes));

  // Write optional intake data (Google Scholar URL, future research direction)
  const scholarUrl = (formData.get("google_scholar_url") as string | null)?.trim() || undefined;
  const futureResearch = (formData.get("future_research") as string | null)?.trim() || undefined;
  const intake: IntakeData = { google_scholar_url: scholarUrl, future_research: futureResearch };
  writeFileSync(resolve(researcherDir, "intake.json"), JSON.stringify(intake, null, 2));

  return Response.json({ name, cvPath: `researchers/${name}/raw/cv.${ext}` });
}
