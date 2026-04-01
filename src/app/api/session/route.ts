import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { slugify } from "@/lib/slugify";

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

  mkdirSync(rawDir, { recursive: true });

  // Determine file extension
  const originalName = file.name;
  const ext = originalName.includes(".")
    ? originalName.split(".").pop() ?? "md"
    : "md";

  const cvPath = resolve(rawDir, `cv.${ext}`);
  const bytes = await file.arrayBuffer();
  writeFileSync(cvPath, Buffer.from(bytes));

  return Response.json({ name, cvPath: `researchers/${name}/raw/cv.${ext}` });
}
