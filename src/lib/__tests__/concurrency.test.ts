import { AgentSemaphore } from "../concurrency";

jest.useFakeTimers();

describe("AgentSemaphore", () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it("allows up to concurrency limit to acquire immediately", async () => {
    const sem = new AgentSemaphore(2);
    await sem.acquire();
    await sem.acquire();
    expect(sem.running).toBe(2);
    expect(sem.pending).toBe(0);
  });

  it("queues a third acquire when limit=2 is saturated", async () => {
    const sem = new AgentSemaphore(2);
    await sem.acquire();
    await sem.acquire();

    let resolved = false;
    sem.acquire().then(() => { resolved = true; });

    // Drain microtasks — third acquire should still be pending
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(sem.pending).toBe(1);
  });

  it("resolves queued waiters in FIFO order when released", async () => {
    const sem = new AgentSemaphore(1);
    await sem.acquire(); // saturated

    const order: number[] = [];
    sem.acquire().then(() => order.push(1));
    sem.acquire().then(() => order.push(2));
    sem.acquire().then(() => order.push(3));

    sem.release(); // unblocks waiter 1
    await Promise.resolve();
    await Promise.resolve();

    expect(order).toEqual([1]);
    expect(sem.running).toBe(1);

    sem.release(); // unblocks waiter 2
    await Promise.resolve();
    await Promise.resolve();

    expect(order).toEqual([1, 2]);
  });

  it("rejects with timeout error when acquire times out", async () => {
    const sem = new AgentSemaphore(1);
    await sem.acquire(); // saturated

    const pending = sem.acquire(50); // 50ms timeout
    const rejection = expect(pending).rejects.toThrow(/timeout|busy/i);

    jest.advanceTimersByTime(51);
    await rejection;
  });

  it("running and pending counters reflect correct state", async () => {
    const sem = new AgentSemaphore(2);

    expect(sem.running).toBe(0);
    expect(sem.pending).toBe(0);

    await sem.acquire();
    expect(sem.running).toBe(1);

    await sem.acquire();
    expect(sem.running).toBe(2);
    expect(sem.pending).toBe(0);

    let resolved = false;
    sem.acquire().then(() => { resolved = true; });
    await Promise.resolve();
    expect(sem.pending).toBe(1);

    sem.release();
    await Promise.resolve();
    await Promise.resolve();
    expect(sem.running).toBe(2);
    expect(sem.pending).toBe(0);
  });

  it("clears timeout when waiter is resolved by release", async () => {
    const sem = new AgentSemaphore(1);
    await sem.acquire(); // saturated

    let timedOut = false;
    const p = sem.acquire(1000).catch((e) => { timedOut = /timeout/i.test(e.message); });

    sem.release(); // should resolve the waiter before timeout fires
    await Promise.resolve();
    await Promise.resolve();

    jest.advanceTimersByTime(2000); // advance past timeout
    await p;

    expect(timedOut).toBe(false); // timeout should NOT have fired
  });
});
