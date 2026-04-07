import { resolve } from "path";

/**
 * Extract text from a PDF buffer using pdfjs-dist.
 * Isolated in its own module so it can be mocked in Jest
 * (pdfjs-dist uses ESM which Jest's CJS transform can't handle).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Resolve the worker path absolutely so Next.js can find it outside the bundle
  pdfjsLib.GlobalWorkerOptions.workerSrc = resolve(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .filter((item) => "str" in item)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item) => (item as any).str as string)
        .join(" ")
    );
  }
  return pages.join("\n").trim();
}
