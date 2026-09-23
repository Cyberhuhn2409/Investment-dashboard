import { describe, expect, it } from "vitest";
import { dailyMoveZ, isRelevant } from "./relevance";

function series(n: number, dailyMove: (i: number) => number): number[] {
  const out = [100];
  for (let i = 1; i < n; i++) out.push(out[i - 1]! * (1 + dailyMove(i)));
  return out;
}

describe("Relevanz", () => {
  it("misst die Tagesbewegung relativ zur üblichen Schwankung", () => {
    const calm = series(70, (i) => (i % 2 ? 0.01 : -0.01));
    const jump = [...calm, calm[calm.length - 1]! * 1.05];
    expect(dailyMoveZ(jump)).toBeGreaterThan(4);
    const drop = [...calm, calm[calm.length - 1]! * 0.95];
    expect(dailyMoveZ(drop)).toBeLessThan(-4);
    const normal = [...calm, calm[calm.length - 1]! * 1.01];
    expect(Math.abs(dailyMoveZ(normal))).toBeLessThan(1.5);
  });

  it("ist robust bei zu kurzer Historie und flachen Kursen", () => {
    expect(dailyMoveZ([1, 2, 3])).toBe(0);
    const flat = Array.from({ length: 40 }, () => 50);
    expect(dailyMoveZ([...flat, 50.1])).toBeLessThan(1);
  });

  it("gilt bei markiertem Signal oder großer Tagesbewegung", () => {
    expect(isRelevant({ score: 65, moveZ: 0 })).toBe(true);
    expect(isRelevant({ score: 30, moveZ: -3 })).toBe(true);
    expect(isRelevant({ score: 59, moveZ: 2.4 })).toBe(false);
  });
});
