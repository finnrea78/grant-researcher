/**
 * Phase 4: Tests for intake GET/PATCH route DB-first rewrite.
 * GET: reads from researchers table (getResearcherFull) instead of intake.json
 * PATCH: upsertResearcher + uploadCv (if new CV) + reset pipeline_state + deleteMatchesForResearcher
 */

jest.mock("@/lib/auth", () => ({
  requireUser: jest.fn().mockResolvedValue({ user: { id: "user-123" }, supabase: {} }),
}));

jest.mock("@/lib/researcher-store", () => ({
  getResearcherFull: jest.fn(),
  upsertResearcher: jest.fn().mockResolvedValue("researcher-uuid-123"),
  updatePipelineState: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/match-store", () => ({
  deleteMatchesForResearcher: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/cv-store", () => ({
  uploadCv: jest.fn().mockResolvedValue("researcher-uuid-123/cv.pdf"),
}));

jest.mock("@/lib/extractCvText", () => ({
  extractCvText: jest.fn().mockResolvedValue("Extracted CV text content"),
}));

// Verify no filesystem imports are used
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmSync: jest.fn(),
}));

import { GET, PATCH } from "@/app/api/session/[name]/intake/route";
import { getResearcherFull, upsertResearcher, updatePipelineState } from "@/lib/researcher-store";
import { deleteMatchesForResearcher } from "@/lib/match-store";
import { uploadCv } from "@/lib/cv-store";
import * as fs from "fs";

const mockGetResearcherFull = getResearcherFull as jest.Mock;
const mockUpsertResearcher = upsertResearcher as jest.Mock;
const mockUpdatePipelineState = updatePipelineState as jest.Mock;
const mockDeleteMatches = deleteMatchesForResearcher as jest.Mock;
const mockUploadCv = uploadCv as jest.Mock;
const mockExistsSync = fs.existsSync as jest.Mock;
const mockWriteFileSync = fs.writeFileSync as jest.Mock;

const RESEARCHER = {
  id: "researcher-uuid-123",
  slug: "jane-smith",
  name: "Jane Smith",
  cv_text: "CV content here",
  enriched_profile: null,
  pipeline_state: { intake: true, profile: true },
  publications_md: null,
  match_results_md: null,
  scholar_candidate: null,
};

function makeGetRequest(): [Request, { params: { name: string } }] {
  return [
    new Request("http://localhost/api/session/jane-smith/intake"),
    { params: { name: "jane-smith" } },
  ];
}

function makePatchRequest(formData: FormData): [Request, { params: { name: string } }] {
  return [
    new Request("http://localhost/api/session/jane-smith/intake", {
      method: "PATCH",
      body: formData,
    }),
    { params: { name: "jane-smith" } },
  ];
}

describe("GET /api/session/[name]/intake (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns intake data from DB without cv_text", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const [req, ctx] = makeGetRequest();
    const res = await GET(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.intake).toBeDefined();
    expect(body.intake.name).toBe("Jane Smith");
    // cv_text should not be sent to client
    expect(body.intake.cv_text).toBeUndefined();
  });

  it("returns 404 when researcher not found", async () => {
    mockGetResearcherFull.mockResolvedValue(null);

    const [req, ctx] = makeGetRequest();
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("does not use filesystem", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);

    const [req, ctx] = makeGetRequest();
    await GET(req, ctx);

    expect(mockExistsSync).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    const { requireUser } = require("@/lib/auth");
    (requireUser as jest.Mock).mockRejectedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );

    const [req, ctx] = makeGetRequest();
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/session/[name]/intake (DB-first)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls upsertResearcher with updated intake data", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);
    const fd = new FormData();
    fd.append("intake", JSON.stringify({ name: "Jane Smith", institution: "Oxford" }));

    const [req, ctx] = makePatchRequest(fd);
    const res = await PATCH(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockUpsertResearcher).toHaveBeenCalledWith(
      expect.objectContaining({ institution: "Oxford" }),
      "jane-smith",
      "user-123"
    );
  });

  it("resets pipeline_state on re-intake", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);
    const fd = new FormData();
    fd.append("intake", JSON.stringify({ name: "Jane Smith" }));

    const [req, ctx] = makePatchRequest(fd);
    await PATCH(req, ctx);

    // pipeline_state should be reset to just { intake: true }
    expect(mockUpdatePipelineState).toHaveBeenCalledWith(
      "jane-smith",
      "user-123",
      expect.objectContaining({ intake: true })
    );
  });

  it("deletes existing matches on re-intake", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);
    const fd = new FormData();
    fd.append("intake", JSON.stringify({ name: "Jane Smith" }));

    const [req, ctx] = makePatchRequest(fd);
    await PATCH(req, ctx);

    expect(mockDeleteMatches).toHaveBeenCalledWith("researcher-uuid-123");
  });

  it("uploads new CV when file is provided", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);
    const fd = new FormData();
    fd.append("intake", JSON.stringify({ name: "Jane Smith" }));
    const file = new File([Buffer.from("pdf content")], "cv.pdf", { type: "application/pdf" });
    fd.append("cv", file);

    const [req, ctx] = makePatchRequest(fd);
    await PATCH(req, ctx);

    expect(mockUploadCv).toHaveBeenCalledWith(
      "researcher-uuid-123",
      expect.any(Buffer),
      "application/pdf",
      "pdf"
    );
  });

  it("passes proposal_intent to upsertResearcher when provided", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);
    const proposalIntent = { project_title: "AI Study", description: "Researching AI safety" };
    const fd = new FormData();
    fd.append("intake", JSON.stringify({ name: "Jane Smith", proposal_intent: proposalIntent }));

    const [req, ctx] = makePatchRequest(fd);
    await PATCH(req, ctx);

    expect(mockUpsertResearcher).toHaveBeenCalledWith(
      expect.objectContaining({ proposal_intent: proposalIntent }),
      "jane-smith",
      "user-123"
    );
  });

  it("does not write to filesystem", async () => {
    mockGetResearcherFull.mockResolvedValue(RESEARCHER);
    const fd = new FormData();
    fd.append("intake", JSON.stringify({ name: "Jane Smith" }));

    const [req, ctx] = makePatchRequest(fd);
    await PATCH(req, ctx);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid intake JSON", async () => {
    const fd = new FormData();
    fd.append("intake", "invalid-json");

    const [req, ctx] = makePatchRequest(fd);
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireUser } = require("@/lib/auth");
    (requireUser as jest.Mock).mockRejectedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );

    const fd = new FormData();
    fd.append("intake", JSON.stringify({ name: "Jane Smith" }));

    const [req, ctx] = makePatchRequest(fd);
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(401);
  });
});
