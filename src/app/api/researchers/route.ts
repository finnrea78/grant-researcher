import { requireUser } from "@/lib/auth";
import { listResearchersWithProfiles } from "@/lib/researcher-store";

export async function GET(): Promise<Response> {
  try {
    const { supabase } = await requireUser();
    const researchers = await listResearchersWithProfiles(supabase);
    return Response.json(researchers);
  } catch (err) {
    if (err instanceof Response) return err;
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
