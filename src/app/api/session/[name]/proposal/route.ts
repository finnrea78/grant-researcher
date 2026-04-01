import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
): Promise<Response> {
  const { name } = await params;
  const proposalsDir = resolve(process.cwd(), `data/outputs/${name}/proposals`);

  if (!existsSync(proposalsDir)) {
    return Response.json({ proposals: [] });
  }

  const files = readdirSync(proposalsDir).filter((f) => f.endsWith(".md"));
  const proposals = files.map((filename) => ({
    filename,
    content: readFileSync(resolve(proposalsDir, filename), "utf-8"),
  }));

  return Response.json({ proposals });
}
