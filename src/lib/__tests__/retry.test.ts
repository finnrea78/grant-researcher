import { withRetry, RetryOptions } from "../retry";

// Fake timers so tests don't actually sleep
jest.useFakeTimers();

function flushTimers() {
  return new Promise<void>((resolve) => {
    jest.runAllTimersAsync().then(resolve);
  });
}

describe("withRetry", () => {
  afterEach(() => {
    delete process.env.DISABLE_RETRY;
    jest.clearAllTimers();
  });

  it("returns value immediately when fn succeeds on first try", async () => {
    const fn = jest.fn().mockResolvedValue(42);
    const result = await withRetry(fn);
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and returns value when fn eventually succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("rate limited"), { status: 429 }))
      .mockRejectedValueOnce(Object.assign(new Error("rate limited"), { status: 429 }))
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });
    await flushTimers();
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting maxRetries", async () => {
    const err = Object.assign(new Error("server error"), { status: 500 });
    const fn = jest.fn().mockRejectedValue(err);

    const promise = withRetry(fn, { maxRetries: 2, baseDelayMs: 100 });
    // Attach handler before flushing to avoid unhandled rejection detection
    const assertion = expect(promise).rejects.toThrow("server error");
    await flushTimers();
    await assertion;

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("does not retry when isRetryable returns false", async () => {
    const err = new Error("not retryable");
    const fn = jest.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, { isRetryable: () => false })
    ).rejects.toThrow("not retryable");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry callback with correct args", async () => {
    const err = Object.assign(new Error("oops"), { status: 429 });
    const fn = jest
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("done");
    const onRetry = jest.fn();

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 1000, onRetry });
    await flushTimers();
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    const [attempt, delay, error] = onRetry.mock.calls[0];
    expect(attempt).toBe(1);
    expect(typeof delay).toBe("number");
    expect(delay).toBeGreaterThan(0);
    expect(error).toBe(err);
  });

  it("skips all retries when DISABLE_RETRY=true", async () => {
    process.env.DISABLE_RETRY = "true";
    const err = Object.assign(new Error("rate limited"), { status: 429 });
    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow("rate limited");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects Retry-After header value over computed delay", async () => {
    const headers = new Headers({ "retry-after": "5" });
    const err = Object.assign(new Error("rate limited"), { status: 429, headers });
    const fn = jest
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("ok");
    const onRetry = jest.fn();

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 1000, onRetry });
    await flushTimers();
    await promise;

    const [, delay] = onRetry.mock.calls[0];
    // Should use ~5000ms from header, not 1000ms base
    expect(delay).toBeGreaterThanOrEqual(5000);
  });

  it("retries on 500, 502, 503, 529 status codes by default", async () => {
    for (const status of [500, 502, 503, 529]) {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error("err"), { status }))
        .mockResolvedValue("ok");
      const promise = withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });
      await flushTimers();
      await expect(promise).resolves.toBe("ok");
    }
  });

  it("retries on errors with 'rate' in message", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("rate limit exceeded"))
      .mockResolvedValue("ok");
    const promise = withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });
    await flushTimers();
    await expect(promise).resolves.toBe("ok");
  });
});
