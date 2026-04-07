import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getResearcherBySlug, updateResearcherProfile, updateProfileEmbedding } from "@/lib/researcher-store";

export async function POST(req: Request): Promise<Response> {
  const { slug } = (await req.json()) as { slug: string };

  if (!slug) {
    return Response.json({ error: "slug is required" }, { status: 400 });
  }

  const researcher = await getResearcherBySlug(slug);
  if (!researcher) {
    return Response.json(
      { error: `Researcher "${slug}" not found or has no completed profile` },
      { status: 404 }
    );
  }

  const dataDir = resolve(process.cwd(), "data");
  const researcherDir = resolve(dataDir, `researchers/${slug}`);
  mkdirSync(resolve(researcherDir, "raw"), { recursive: true });

  // Write profile.json from DB enriched_profile
  writeFileSync(
    resolve(researcherDir, "profile.json"),
    JSON.stringify(researcher.enriched_profile, null, 2)
  );

  // Write minimal intake.json
  writeFileSync(
    resolve(researcherDir, "intake.json"),
    JSON.stringify({ name: researcher.name }, null, 2)
  );

  // Write stage completion markers
  writeFileSync(resolve(researcherDir, "_scholar-skip"), new Date().toISOString());
  writeFileSync(resolve(researcherDir, "_scan-complete"), new Date().toISOString());

  // Sync research_themes and research_keywords to DB top-level columns
  // (enriched_profile JSONB has the data but the retrieval columns may be empty)
  await updateResearcherProfile(slug, researcher.enriched_profile);

  // Generate profile embedding if retrieval_summary exists but embedding is missing
  if (researcher.enriched_profile.retrieval_summary) {
    try {
      await updateProfileEmbedding(slug, researcher.enriched_profile.retrieval_summary);
    } catch (err) {
      console.error(`[hydrate] embedding failed for ${slug}:`, err);
    }
  }

  return Response.json({ name: slug });
}
