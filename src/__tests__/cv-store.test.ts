/**
 * Phase 2: Tests for cv-store module.
 * CV file uploads to Supabase Storage, replacing data/researchers/{name}/raw/ files.
 */

import { getCvText } from "@/lib/cv-store";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}));

import { supabase } from "@/lib/supabase";
const fromMock = supabase.from as jest.Mock;
const storageMock = supabase.storage.from as jest.Mock;

function makeChain(result: { data?: unknown; error?: unknown }) {
  const resultPromise = Promise.resolve(result);
  const single: jest.Mock = jest.fn(() => resultPromise);
  const eq: jest.Mock = jest.fn(() => Object.assign(resultPromise, { eq, single }));
  const select: jest.Mock = jest.fn(() => Object.assign(resultPromise, { eq, single }));
  return { select, eq, single };
}

describe("getCvText", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns cv_text for a researcher by slug", async () => {
    const chain = makeChain({ data: { cv_text: "Dr Jane Smith, Professor of Quantum Computing" }, error: null });
    fromMock.mockReturnValue(chain);

    const result = await getCvText("jane-smith");

    expect(result).toBe("Dr Jane Smith, Professor of Quantum Computing");
    expect(fromMock).toHaveBeenCalledWith("researchers");
    expect(chain.eq).toHaveBeenCalledWith("slug", "jane-smith");
  });

  it("returns null when researcher has no cv_text", async () => {
    const chain = makeChain({ data: { cv_text: null }, error: null });
    fromMock.mockReturnValue(chain);

    const result = await getCvText("jane-smith");
    expect(result).toBeNull();
  });

  it("returns null when researcher does not exist", async () => {
    const chain = makeChain({ data: null, error: { message: "Not found" } });
    fromMock.mockReturnValue(chain);

    const result = await getCvText("nonexistent");
    expect(result).toBeNull();
  });
});

describe("uploadCv", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uploads a CV file to Supabase Storage under the researcher's id", async () => {
    const { uploadCv } = await import("@/lib/cv-store");
    const storageChain = {
      upload: jest.fn().mockResolvedValue({ data: { path: "uuid-123/cv.pdf" }, error: null }),
    };
    storageMock.mockReturnValue(storageChain);

    await uploadCv("uuid-123", Buffer.from("%PDF content"), "application/pdf", "pdf");

    expect(storageMock).toHaveBeenCalledWith("cv-uploads");
    expect(storageChain.upload).toHaveBeenCalledWith(
      "uuid-123/cv.pdf",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "application/pdf", upsert: true })
    );
  });

  it("throws on storage error", async () => {
    const { uploadCv } = await import("@/lib/cv-store");
    const storageChain = {
      upload: jest.fn().mockResolvedValue({ data: null, error: { message: "Storage quota exceeded" } }),
    };
    storageMock.mockReturnValue(storageChain);

    await expect(uploadCv("uuid-123", Buffer.from("content"), "application/pdf", "pdf")).rejects.toThrow(
      "Storage quota exceeded"
    );
  });
});

describe("getCvUrl", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns a signed URL for the CV file", async () => {
    const { getCvUrl } = await import("@/lib/cv-store");
    const storageChain = {
      createSignedUrl: jest.fn().mockResolvedValue({
        data: { signedUrl: "https://storage.supabase.co/cv.pdf?token=abc" },
        error: null,
      }),
    };
    storageMock.mockReturnValue(storageChain);

    const url = await getCvUrl("uuid-123", "pdf");

    expect(url).toContain("cv.pdf");
    expect(storageMock).toHaveBeenCalledWith("cv-uploads");
  });

  it("returns null when the file does not exist", async () => {
    const { getCvUrl } = await import("@/lib/cv-store");
    const storageChain = {
      createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
    };
    storageMock.mockReturnValue(storageChain);

    const url = await getCvUrl("uuid-123", "pdf");
    expect(url).toBeNull();
  });
});
