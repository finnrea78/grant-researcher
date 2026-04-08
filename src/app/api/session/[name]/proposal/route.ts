import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";
import { requireUser } from "@/lib/auth";

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
