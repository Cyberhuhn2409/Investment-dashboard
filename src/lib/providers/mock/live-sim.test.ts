import { describe, expect, it } from "vitest";
import { simulatedTick } from "./live-sim";

const P = { key: "TEST", base: 100, dailyVol: 0.02, liquidity: 0.6 };
const T0 = Date.parse("2026-09-23T15:00:00Z");

describe("Live-Simulation", () => {
  it("ist deterministisch und hängt nur von der Zeit ab", () => {
    expect(simulatedTick(P, T0)).toEqual(simulatedTick({ ...P }, T0));
    expect(simulatedTick(P, T0 + 400).time).toBe(simulatedTick(P, T0).time);
  });

  it("bewegt sich im Sekundentakt, bleibt aber nahe am Referenzkurs", () => {
    const prices = Array.from({ length: 600 }, (_, i) => simulatedTick(P, T0 + i * 1000).price);
    const changes = prices.slice(1).filter((p, i) => p !== prices[i]).length;
    expect(changes).toBeGreaterThan(200);
    for (const p of prices) {
      expect(p).toBeGreaterThan(97);
      expect(p).toBeLessThan(103);
    }
    const maxStep = Math.max(...prices.slice(1).map((p, i) => Math.abs(p / prices[i]! - 1)));
    expect(maxStep).toBeLessThan(0.002);
  });

  it("illiquide Werte ticken seltener", () => {
    const count = (liquidity: number) => {
      const times = new Set(Array.from({ length: 300 }, (_, i) => simulatedTick({ ...P, liquidity }, T0 + i * 1000).time));
      return times.size;
    };
    expect(count(0.2)).toBeLessThan(count(0.9));
  });
});
