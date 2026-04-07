import mammoth from "mammoth";
import { extractPdfText } from "./pdfExtract";

/**
 * Extract text content from a CV file buffer based on its filename extension.
 * Returns null for unsupported formats or if extraction fails.
 */
export async function extractCvText(
  buffer: Buffer,
  filename: string
): Promise<string | null> {
  const ext = filename.includes(".")
    ? filename.split(".").pop()?.toLowerCase() ?? ""
    : "";

  switch (ext) {
    case "md":
    case "txt":
      return buffer.toString("utf-8");

    case "pdf":
      try {
        const text = await extractPdfText(buffer);
        return text || null;
      } catch (err) {
        console.error("[extractCvText] PDF extraction failed:", err);
        return null;
      }

    case "docx":
      try {
        const result = await mammoth.extractRawText({ buffer });
        const text = result.value?.trim();
        return text || null;
      } catch {
        return null;
      }

    default:
      return null;
  }
}
