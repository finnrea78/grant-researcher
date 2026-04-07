// Tests for requireUser() helper (src/lib/auth.ts)
export {};

const mockGetUser = jest.fn();
const mockServerClient = { auth: { getUser: mockGetUser } };
const mockCreateSupabaseServer = jest.fn().mockReturnValue(mockServerClient);

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: mockCreateSupabaseServer,
}));

beforeEach(() => jest.clearAllMocks());

describe("requireUser", () => {
  it("returns user and supabase client when session is valid", async () => {
    const fakeUser = { id: "user-123", email: "test@example.com" };
    mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null });

    const { requireUser } = await import("@/lib/auth");
    const result = await requireUser();

    expect(result.user).toEqual(fakeUser);
    expect(result.supabase).toBe(mockServerClient);
  });

  it("throws a 401 Response when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { requireUser } = await import("@/lib/auth");

    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("throws a 401 Response when getUser returns an error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "JWT expired" },
    });

    const { requireUser } = await import("@/lib/auth");

    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
});
