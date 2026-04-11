// Promise-based semaphore for limiting concurrent Claude Agent SDK calls.
// Prevents simultaneous requests from spiking token usage and hitting rate limits.

type Waiter = {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class AgentSemaphore {
  private _running = 0;
  private _queue: Waiter[] = [];

  constructor(private readonly concurrency: number) {}

  get running(): number {
    return this._running;
  }

  get pending(): number {
    return this._queue.length;
  }

  acquire(timeoutMs = 30_000): Promise<void> {
    if (this._running < this.concurrency) {
      this._running++;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this._queue.findIndex((w) => w.timer === timer);
        if (idx !== -1) this._queue.splice(idx, 1);
        reject(new Error("Agent queue timeout — server is busy, please retry"));
      }, timeoutMs);

      this._queue.push({ resolve, reject, timer });
    });
  }

  release(): void {
    this._running = Math.max(0, this._running - 1);
    const next = this._queue.shift();
    if (next) {
      clearTimeout(next.timer);
      this._running++;
      next.resolve();
    }
  }
}

/** Singleton semaphore — max 2 concurrent Claude Agent SDK queries across all routes. */
export const agentQueue = new AgentSemaphore(2);
