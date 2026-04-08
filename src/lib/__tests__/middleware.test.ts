// Tests for src/middleware.ts
export {};

const mockGetUser = jest.fn();
const mockMiddlewareClient = { auth: { getUser: mockGetUser } };
const mockCreateSupabaseMiddleware = jest.fn().mockReturnValue(mockMiddlewareClient);

jest.mock("@/lib/supabase/middleware", () => ({
  createSupabaseMiddleware: mockCreateSupabaseMiddleware,
}));

// Minimal NextResponse mock
const mockNextResponseNext = jest.fn();
const mockRedirect = jest.fn();

jest.mock("next/server", () => ({
  NextResponse: {
    next: (opts?: unknown) => {
      mockNextResponseNext(opts);
      return {
        cookies: { set: jest.fn() },
        // Fake "next" response — not a redirect
        _isNext: true,
      };
    },
    redirect: (url: unknown) => {
      mockRedirect(url);
      return { _redirectUrl: url };
    },
  },
}));

beforeEach(() => jest.clearAllMocks());

function makeReq(pathname: string) {
  return {
    nextUrl: { pathname, clone: () => ({ pathname, toString: () => `http://localhost${pathname}` }) },
    url: `http://localhost${pathname}`,
    cookies: { getAll: jest.fn().mockReturnValue([]), set: jest.fn() },
  };
}

describe("middleware", () => {
  it("redirects to /login when no authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { middleware } = await import("@/middleware");

    await middleware(makeReq("/") as never);

    expect(mockRedirect).toHaveBeenCalled();
    const redirectArg = mockRedirect.mock.calls[0][0];
    expect(redirectArg.toString()).toContain("/login");
  });

  it("passes through when user is authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const { middleware } = await import("@/middleware");

    const result = await middleware(makeReq("/") as never);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect((result as unknown as { _isNext: boolean })._isNext).toBe(true);
  });

  it("redirects authenticated users away from /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const { middleware } = await import("@/middleware");

    await middleware(makeReq("/login") as never);

    expect(mockRedirect).toHaveBeenCalled();
    const redirectArg = mockRedirect.mock.calls[0][0];
    expect(redirectArg.toString()).toContain("/");
    expect(redirectArg.toString()).not.toContain("/login");
  });

  it("allows unauthenticated access to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { middleware } = await import("@/middleware");

    const result = await middleware(makeReq("/login") as never);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect((result as unknown as { _isNext: boolean })._isNext).toBe(true);
  });
});
