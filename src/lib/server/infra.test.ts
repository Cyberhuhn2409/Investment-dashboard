import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cached, clearCache } from "./cache";
import { RateLimitError, RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("vergibt Tokens bis zum Limit und füllt zeitabhängig nach", () => {
    let now = 0;
    const l = new RateLimiter("test", { perMinute: 2 }, () => now);
    expect(l.tryTake()).toBe(true);
    expect(l.tryTake()).toBe(true);
    expect(l.tryTake()).toBe(false);
    expect(l.waitTime()).toBe(30_000);
    now += 30_000;
    expect(l.tryTake()).toBe(true);
  });

  it("respektiert Tageslimits", async () => {
    let now = Date.UTC(2026, 8, 23, 10);
    const l = new RateLimiter("day", { perMinute: 100, perDay: 2 }, () => now);
    await l.take();
    await l.take();
    await expect(l.take()).rejects.toBeInstanceOf(RateLimitError);
    now = Date.UTC(2026, 8, 24, 0, 1);
    await expect(l.take()).resolves.toBeUndefined();
  });

  it("pausiert nach 429 (Cooldown) und bricht bei zu langer Wartezeit ab", async () => {
    let now = 0;
    const l = new RateLimiter("cool", { perMinute: 60, maxWaitMs: 1_000 }, () => now);
    l.penalize(30_000);
    expect(l.waitTime()).toBe(30_000);
    await expect(l.take()).rejects.toBeInstanceOf(RateLimitError);
    now = 31_000;
    expect(l.tryTake()).toBe(true);
  });
});

describe("cached (Stale-While-Revalidate)", () => {
  beforeEach(() => {
    clearCache();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("liefert frische Werte aus dem Cache", async () => {
    const loader = vi.fn(async () => 1);
    await cached("a", loader, { ttl: 1_000 });
    const r = await cached("a", loader, { ttl: 1_000 });
    expect(r.value).toBe(1);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("teilt parallele Anfragen (In-Flight-Dedupe)", async () => {
    const loader = vi.fn(async () => 42);
    const [a, b] = await Promise.all([cached("b", loader, { ttl: 1_000 }), cached("b", loader, { ttl: 1_000 })]);
    expect(a.value).toBe(42);
    expect(b.value).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("liefert veraltete Werte sofort und erneuert im Hintergrund", async () => {
    let n = 0;
    const loader = vi.fn(async () => ++n);
    await cached("c", loader, { ttl: 1_000, staleTtl: 60_000 });
    vi.advanceTimersByTime(2_000);
    const stale = await cached("c", loader, { ttl: 1_000, staleTtl: 60_000 });
    expect(stale.value).toBe(1);
    await vi.runAllTimersAsync();
    const fresh = await cached("c", loader, { ttl: 1_000, staleTtl: 60_000 });
    expect(fresh.value).toBe(2);
  });

  it("markiert Werte als veraltet, wenn die Erneuerung scheitert", async () => {
    await cached("d", async () => "alt", { ttl: 1_000, staleTtl: 60_000 });
    vi.advanceTimersByTime(2_000);
    const failing = async () => {
      throw new Error("Anbieter down");
    };
    await cached("d", failing, { ttl: 1_000, staleTtl: 60_000 });
    await vi.runAllTimersAsync();
    const r = await cached("d", failing, { ttl: 1_000, staleTtl: 60_000 });
    expect(r.value).toBe("alt");
    expect(r.stale).toBe(true);
  });

  it("wirft, wenn weder frische noch alte Daten existieren", async () => {
    await expect(
      cached("e", async () => {
        throw new Error("nope");
      }, { ttl: 1_000 }),
    ).rejects.toThrow("nope");
  });
});

describe("Cache mit wertabhängiger Laufzeit", () => {
  it("nutzt die aus dem Wert berechnete TTL", async () => {
    const { cached, clearCache } = await import("./cache");
    clearCache();
    let calls = 0;
    const load = async () => ({ complete: ++calls > 1 });
    const opts = { ttl: (v: { complete: boolean }) => (v.complete ? 60_000 : 0) };
    await cached("dyn", load, opts);
    // unvollständig → sofort abgelaufen, nächster Aufruf lädt im Hintergrund neu
    await cached("dyn", load, opts);
    await new Promise((r) => setTimeout(r, 10));
    const third = await cached("dyn", load, opts);
    expect(third.value.complete).toBe(true);
    expect(calls).toBe(2);
  });
});
