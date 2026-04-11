// Server-only module — only import in Next.js API routes, not client components.
import { supabase } from "@/lib/supabase";

const BUCKET = "cv-uploads";

/**
 * Upload a CV file to Supabase Storage under {researcherId}/cv.{ext}.
 * Overwrites any existing file for the researcher.
 */
export async function uploadCv(
  researcherId: string,
  file: Buffer,
  contentType: string,
  ext: string
): Promise<string> {
  const path = `${researcherId}/cv.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Get a short-lived signed URL for downloading a researcher's CV.
 * Returns null if no CV has been uploaded.
 */
export async function getCvUrl(
  researcherId: string,
  ext: string
): Promise<string | null> {
  const path = `${researcherId}/cv.${ext}`;
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/**
 * Read cv_text from the researchers table.
 * Returns null if not set or researcher not found.
 */
export async function getCvText(slug: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("researchers")
    .select("cv_text")
    .eq("slug", slug)
    .single();
  if (error || !data) return null;
  return data.cv_text ?? null;
}
