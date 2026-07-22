import { randomDelayMs, sleep } from '@leadhunter/shared';

export class Throttle {
  private queue: Promise<void> = Promise.resolve();
  private lastRun = 0;

  constructor(private readonly minIntervalMs: number) {}

  async wait(): Promise<void> {
    this.queue = this.queue.then(async () => {
      const interval = randomDelayMs(this.minIntervalMs, 0.35);
      const now = Date.now();
      const waitFor = Math.max(0, interval - (now - this.lastRun));
      if (waitFor > 0) await sleep(waitFor);
      this.lastRun = Date.now();
    });
    return this.queue;
  }
}
