import { listResearchersWithProfiles } from "@/lib/researcher-store";

export async function GET(): Promise<Response> {
  try {
    const researchers = await listResearchersWithProfiles();
    return Response.json(researchers);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
