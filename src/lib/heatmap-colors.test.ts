import { describe, expect, it } from "vitest";
import { heatColor, PRICE_CAP } from "./heatmap-colors";

function luminance(rgb: string): number {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrastWithWhite = (rgb: string) => 1.05 / (luminance(rgb) + 0.05);

describe("Heatmap-Farben", () => {
  it("weiße Schrift erreicht auf allen Stufen WCAG AA (4,5:1)", () => {
    for (const theme of ["dark", "light"] as const) {
      for (let v = -5; v <= 5; v += 0.25) {
        expect(contrastWithWhite(heatColor("price", v, theme, "1D"))).toBeGreaterThanOrEqual(4.5);
      }
      for (let v = -100; v <= 500; v += 20) {
        expect(contrastWithWhite(heatColor("buzz", v, theme))).toBeGreaterThanOrEqual(4.5);
      }
      for (let v = -1; v <= 1; v += 0.1) {
        expect(contrastWithWhite(heatColor("sentiment", v, theme))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("Vorzeichen bestimmt Farbrichtung, Kappung greift", () => {
    const up = heatColor("price", PRICE_CAP["1D"], "dark");
    const down = heatColor("price", -PRICE_CAP["1D"], "dark");
    expect(up).not.toEqual(down);
    expect(heatColor("price", PRICE_CAP["1D"] * 3, "dark")).toEqual(up);
    expect(heatColor("price", null, "dark")).toEqual(heatColor("price", 0, "dark"));
  });
});
