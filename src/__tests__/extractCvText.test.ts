import { resolve } from "path";
import { readFileSync } from "fs";
import { extractCvText } from "@/lib/extractCvText";

jest.mock("@/lib/pdfExtract", () => ({
  extractPdfText: jest.fn(async (buffer: Buffer) => {
    // Verify we receive a real buffer, return simulated extraction
    if (buffer.length < 100) throw new Error("Invalid PDF");
    return "Dr Jane Smith, University of Oxford. Research focus: quantum computing and machine learning.";
  }),
}));

const FIXTURES = resolve(__dirname, "fixtures");

describe("extractCvText", () => {
  it("extracts text from a .md file", async () => {
    const md = "# Dr Jane Smith\n\nResearch: quantum computing";
    const result = await extractCvText(Buffer.from(md), "cv.md");
    expect(result).toBe(md);
  });

  it("extracts text from a .txt file", async () => {
    const txt = "Dr Jane Smith — quantum computing researcher";
    const result = await extractCvText(Buffer.from(txt), "cv.txt");
    expect(result).toBe(txt);
  });

  it("extracts text from a PDF file", async () => {
    const pdfBuf = readFileSync(resolve(FIXTURES, "sample.pdf"));
    const result = await extractCvText(pdfBuf, "cv.pdf");
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(10);
    expect(result).toContain("Jane Smith");
  });

  it("extracts text from a DOCX file", async () => {
    const docxBuf = readFileSync(resolve(FIXTURES, "sample.docx"));
    const result = await extractCvText(docxBuf, "cv.docx");
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(10);
    expect(result).toContain("Jane Smith");
  });

  it("returns null for unsupported extensions", async () => {
    const result = await extractCvText(Buffer.from("data"), "cv.zip");
    expect(result).toBeNull();
  });

  it("returns null when PDF extraction fails", async () => {
    // Small buffer triggers mock error
    const result = await extractCvText(Buffer.from("not a pdf"), "cv.pdf");
    expect(result).toBeNull();
  });

  it("returns null when DOCX extraction fails", async () => {
    const result = await extractCvText(Buffer.from("not a docx"), "cv.docx");
    expect(result).toBeNull();
  });
});
