/**
 * Phase 4: Tests for session POST route DB-first rewrite.
 * Replaces mkdirSync + writeFileSync (intake.json, CV file) with:
 *   - upsertResearcher() for intake data
 *   - uploadCv() for binary CV storage
 *   - updatePipelineState(slug, { intake: true }) to mark intake complete
 *   - proposal_intent stored in pipeline_state JSONB, not a file
 */

jest.mock("@/lib/auth", () => ({
  requireUser: jest.fn().mockResolvedValue({ user: { id: "user-123" }, supabase: {} }),
}));

jest.mock("@/lib/researcher-store", () => ({
  upsertResearcher: jest.fn().mockResolvedValue("researcher-uuid-123"),
  updateOrcidData: jest.fn().mockResolvedValue(undefined),
  updatePipelineState: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/cv-store", () => ({
  uploadCv: jest.fn().mockResolvedValue("researcher-uuid-123/cv.pdf"),
}));

jest.mock("@/lib/extractCvText", () => ({
  extractCvText: jest.fn().mockResolvedValue("Extracted CV text content"),
}));

// Verify no filesystem imports are used
jest.mock("fs", () => ({
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

import { POST } from "@/app/api/session/route";
import { upsertResearcher, updatePipelineState } from "@/lib/researcher-store";
import { uploadCv } from "@/lib/cv-store";
import { extractCvText } from "@/lib/extractCvText";
import * as fs from "fs";

const mockUpsertResearcher = upsertResearcher as jest.Mock;
const mockUpdatePipelineState = updatePipelineState as jest.Mock;
const mockUploadCv = uploadCv as jest.Mock;
const mockExtractCvText = extractCvText as jest.Mock;
const mockWriteFileSync = fs.writeFileSync as jest.Mock;
const mockMkdirSync = fs.mkdirSync as jest.Mock;

function makeFormData(overrides: Record<string, string | File | null> = {}): FormData {
  const fd = new FormData();
  fd.append("name", "Jane Smith");
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== null) fd.append(key, value);
  }
  return fd;
}

function makeRequest(formData: FormData): Request {
  return new Request("http://localhost/api/session", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/session (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns { name } slug on success without a CV", async () => {
    const res = await POST(makeRequest(makeFormData()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("jane-smith");
  });

  it("calls upsertResearcher with intake data and userId", async () => {
    const intake = JSON.stringify({ name: "Jane Smith", institution: "UCL" });
    const fd = makeFormData({ intake });

    await POST(makeRequest(fd));

    expect(mockUpsertResearcher).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Jane Smith", institution: "UCL" }),
      "jane-smith",
      "user-123"
    );
  });

  it("strips proposal_intent before calling upsertResearcher", async () => {
    const intake = JSON.stringify({
      name: "Jane Smith",
      proposal_intent: { themes: ["biodiversity"] },
    });
    const fd = makeFormData({ intake });

    await POST(makeRequest(fd));

    expect(mockUpsertResearcher).toHaveBeenCalledWith(
      expect.not.objectContaining({ proposal_intent: expect.anything() }),
      "jane-smith",
      "user-123"
    );
  });

  it("stores proposal_intent in pipeline_state when provided", async () => {
    const proposalIntent = { themes: ["climate"], funder_preference: "UKRI" };
    const intake = JSON.stringify({ name: "Jane Smith", proposal_intent: proposalIntent });
    const fd = makeFormData({ intake });

    await POST(makeRequest(fd));

    expect(mockUpdatePipelineState).toHaveBeenCalledWith(
      "jane-smith",
      expect.objectContaining({ intake: true, proposal_intent: proposalIntent })
    );
  });

  it("calls updatePipelineState with intake: true even without proposal_intent", async () => {
    await POST(makeRequest(makeFormData()));

    expect(mockUpdatePipelineState).toHaveBeenCalledWith(
      "jane-smith",
      expect.objectContaining({ intake: true })
    );
  });

  it("uploads CV file to Supabase Storage when provided", async () => {
    const pdfBytes = Buffer.from("fake pdf content");
    const file = new File([pdfBytes], "resume.pdf", { type: "application/pdf" });
    const fd = makeFormData({ cv: file });

    await POST(makeRequest(fd));

    expect(mockUploadCv).toHaveBeenCalledWith(
      "researcher-uuid-123",
      expect.any(Buffer),
      "application/pdf",
      "pdf"
    );
  });

  it("extracts CV text and includes it in upsertResearcher call", async () => {
    const pdfBytes = Buffer.from("fake pdf content");
    const file = new File([pdfBytes], "resume.pdf", { type: "application/pdf" });
    const fd = makeFormData({ cv: file });

    await POST(makeRequest(fd));

    expect(mockExtractCvText).toHaveBeenCalled();
    expect(mockUpsertResearcher).toHaveBeenCalledWith(
      expect.objectContaining({ cv_text: "Extracted CV text content" }),
      "jane-smith",
      "user-123"
    );
  });

  it("does not write to filesystem", async () => {
    const pdfBytes = Buffer.from("fake pdf content");
    const file = new File([pdfBytes], "resume.pdf", { type: "application/pdf" });
    const fd = makeFormData({ cv: file });

    await POST(makeRequest(fd));

    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  it("returns 400 when name is missing", async () => {
    const fd = new FormData();
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid intake JSON", async () => {
    const fd = makeFormData({ intake: "not-valid-json" });
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireUser } = require("@/lib/auth");
    (requireUser as jest.Mock).mockRejectedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );

    const res = await POST(makeRequest(makeFormData()));
    expect(res.status).toBe(401);
  });
});
