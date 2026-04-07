// Tests for Supabase client factories (src/lib/supabase/server.ts, browser.ts, middleware.ts)

const mockCreateServerClient = jest.fn().mockReturnValue({ auth: {} });
const mockCreateBrowserClient = jest.fn().mockReturnValue({ auth: {} });

jest.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
  createBrowserClient: mockCreateBrowserClient,
}));

// Mock next/headers cookies
const mockGetAll = jest.fn().mockReturnValue([]);
const mockSet = jest.fn();
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    getAll: mockGetAll,
    set: mockSet,
  })),
}));

beforeEach(() => jest.clearAllMocks());

describe("createSupabaseServer", () => {
  it("calls createServerClient with anon key and cookie adapter", async () => {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    createSupabaseServer();

    expect(mockCreateServerClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      expect.objectContaining({ cookies: expect.any(Object) })
    );
  });

  it("cookie adapter reads from next/headers cookies", async () => {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    createSupabaseServer();

    const cookieArg = mockCreateServerClient.mock.calls[0][2];
    mockGetAll.mockReturnValue([{ name: "sb-token", value: "abc" }]);
    const result = cookieArg.cookies.getAll();

    expect(result).toEqual([{ name: "sb-token", value: "abc" }]);
  });

  it("cookie adapter writes to next/headers cookies", async () => {
    const { createSupabaseServer } = await import("@/lib/supabase/server");
    createSupabaseServer();

    const cookieArg = mockCreateServerClient.mock.calls[0][2];
    cookieArg.cookies.setAll([{ name: "sb-token", value: "xyz", options: { httpOnly: true } }]);

    expect(mockSet).toHaveBeenCalledWith("sb-token", "xyz", { httpOnly: true });
  });
});

describe("createSupabaseBrowser", () => {
  it("calls createBrowserClient with anon key", async () => {
    const { createSupabaseBrowser } = await import("@/lib/supabase/browser");
    createSupabaseBrowser();

    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  });
});

describe("createSupabaseMiddleware", () => {
  it("calls createServerClient with request cookie adapter", async () => {
    const { createSupabaseMiddleware } = await import("@/lib/supabase/middleware");

    const mockReq = {
      cookies: {
        getAll: jest.fn().mockReturnValue([{ name: "sb", value: "tok" }]),
        set: jest.fn(),
      },
    };
    const mockRes = {
      cookies: { set: jest.fn() },
    };

    createSupabaseMiddleware(mockReq as never, mockRes as never);

    expect(mockCreateServerClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      expect.objectContaining({ cookies: expect.any(Object) })
    );
  });

  it("cookie adapter reads from request cookies", async () => {
    const { createSupabaseMiddleware } = await import("@/lib/supabase/middleware");

    const mockReq = {
      cookies: {
        getAll: jest.fn().mockReturnValue([{ name: "sb", value: "tok" }]),
        set: jest.fn(),
      },
    };
    const mockRes = { cookies: { set: jest.fn() } };

    createSupabaseMiddleware(mockReq as never, mockRes as never);

    const cookieArg = mockCreateServerClient.mock.calls[0][2];
    const result = cookieArg.cookies.getAll();
    expect(result).toEqual([{ name: "sb", value: "tok" }]);
  });

  it("cookie adapter writes to both request and response cookies", async () => {
    const { createSupabaseMiddleware } = await import("@/lib/supabase/middleware");

    const reqSet = jest.fn();
    const resSet = jest.fn();
    const mockReq = { cookies: { getAll: jest.fn().mockReturnValue([]), set: reqSet } };
    const mockRes = { cookies: { set: resSet } };

    createSupabaseMiddleware(mockReq as never, mockRes as never);

    const cookieArg = mockCreateServerClient.mock.calls[0][2];
    cookieArg.cookies.setAll([{ name: "sb", value: "val", options: { path: "/" } }]);

    expect(reqSet).toHaveBeenCalledWith("sb", "val");
    expect(resSet).toHaveBeenCalledWith("sb", "val", { path: "/" });
  });
});
