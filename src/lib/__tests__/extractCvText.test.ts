import { extractCvText } from "@/lib/extractCvText";

jest.mock("@/lib/pdfExtract", () => ({
  extractPdfText: jest.fn(),
}));

jest.mock("mammoth", () => ({
  __esModule: true,
  default: {
    extractRawText: jest.fn(),
  },
}));

import { extractPdfText } from "@/lib/pdfExtract";
import mammoth from "mammoth";

const mockExtractPdfText = extractPdfText as jest.MockedFunction<typeof extractPdfText>;
const mockExtractRawText = mammoth.extractRawText as jest.MockedFunction<typeof mammoth.extractRawText>;

describe("extractCvText", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("extracts text from a PDF", async () => {
    mockExtractPdfText.mockResolvedValueOnce("Academic CV text from PDF");
    const text = await extractCvText(Buffer.from("%PDF-1.4 fake"), "cv.pdf");
    expect(text).toBe("Academic CV text from PDF");
    expect(mockExtractPdfText).toHaveBeenCalledTimes(1);
  });

  it("returns null when PDF extraction throws", async () => {
    mockExtractPdfText.mockRejectedValueOnce(new Error("Corrupt PDF"));
    const text = await extractCvText(Buffer.from("garbage"), "cv.pdf");
    expect(text).toBeNull();
  });

  it("returns null when PDF extraction yields an empty string", async () => {
    mockExtractPdfText.mockResolvedValueOnce("");
    const text = await extractCvText(Buffer.from("%PDF-1.4"), "cv.pdf");
    expect(text).toBeNull();
  });

  it("extracts text from a DOCX", async () => {
    mockExtractRawText.mockResolvedValueOnce({
      value: "  CV body from DOCX  ",
      messages: [],
    } as Awaited<ReturnType<typeof mammoth.extractRawText>>);
    const text = await extractCvText(Buffer.from("PK docx"), "cv.docx");
    expect(text).toBe("CV body from DOCX");
  });

  it("returns null when DOCX extraction throws", async () => {
    mockExtractRawText.mockRejectedValueOnce(new Error("Bad DOCX"));
    const text = await extractCvText(Buffer.from("garbage"), "cv.docx");
    expect(text).toBeNull();
  });

  it("returns utf-8 text for a .md file", async () => {
    const text = await extractCvText(Buffer.from("# Hello\nWorld", "utf-8"), "cv.md");
    expect(text).toBe("# Hello\nWorld");
  });

  it("returns utf-8 text for a .txt file", async () => {
    const text = await extractCvText(Buffer.from("plain text cv", "utf-8"), "cv.txt");
    expect(text).toBe("plain text cv");
  });

  it("is case-insensitive on the extension", async () => {
    mockExtractPdfText.mockResolvedValueOnce("upper case extension");
    const text = await extractCvText(Buffer.from("%PDF"), "CV.PDF");
    expect(text).toBe("upper case extension");
  });

  it("returns null for an unsupported extension", async () => {
    const text = await extractCvText(Buffer.from("image bytes"), "cv.png");
    expect(text).toBeNull();
    expect(mockExtractPdfText).not.toHaveBeenCalled();
    expect(mockExtractRawText).not.toHaveBeenCalled();
  });

  it("returns null when the filename has no extension", async () => {
    const text = await extractCvText(Buffer.from("bytes"), "cv_no_extension");
    expect(text).toBeNull();
  });
});
