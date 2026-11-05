import { config } from "./config";

/**
 * In-memory sliding-window limiter. Good enough for a single-process,
 * self-hosted instance, which is what this app is. With more than one server
 * process each process keeps its own counters.
 */
export class SlidingWindowLimiter {
  readonly limit: number;
  readonly windowSeconds: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();

  constructor(limit: number, windowSeconds: number) {
    this.limit = limit;
    this.windowSeconds = windowSeconds;
    this.windowMs = windowSeconds * 1000;
  }

  private bucket(key: string, now: number): number[] {
    return (this.hits.get(key) ?? []).filter((at) => now - at <= this.windowMs);
  }

  /** Records a hit when a slot is free; returns false when the key is throttled. */
  check(key: string): boolean {
    const now = Date.now();
    const bucket = this.bucket(key, now);
    if (bucket.length >= this.limit) {
      this.hits.set(key, bucket);
      return false;
    }
    bucket.push(now);
    this.hits.set(key, bucket);
    if (this.hits.size > 5000) {
      for (const [otherKey, times] of this.hits) {
        if (times.length === 0 || now - times[times.length - 1]! > this.windowMs) {
          this.hits.delete(otherKey);
        }
      }
    }
    return true;
  }

  /** Seconds until the key gets a free slot again (0 when it is free now). */
  retryAfter(key: string): number {
    const now = Date.now();
    const bucket = this.bucket(key, now);
    if (bucket.length < this.limit) return 0;
    // The oldest hit that still occupies a slot has to age out.
    const blocking = bucket[bucket.length - this.limit]!;
    return Math.max(1, Math.ceil((blocking + this.windowMs - now) / 1000));
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}

export const loginLimiter = new SlidingWindowLimiter(10, 300);
export const loginIpLimiter = new SlidingWindowLimiter(40, 300);
export const setupLimiter = new SlidingWindowLimiter(5, 300);
export const unlockLimiter = new SlidingWindowLimiter(12, 300);
export const passwordLimiter = new SlidingWindowLimiter(8, 300);

/** Publishing throttle, configured by PUBLISH_RATE_LIMIT / PUBLISH_RATE_WINDOW. */
export const publishLimiter = new SlidingWindowLimiter(
  config.publishLimit > 0 ? config.publishLimit : 1,
  config.publishWindowSeconds,
);
