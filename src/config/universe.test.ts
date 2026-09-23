import { describe, expect, it } from "vitest";
import { SIZE_CLASSES, UNIVERSE, getInstrument, sizeClassFor } from "./universe";

describe("Universum", () => {
  it("hat eindeutige Symbole", () => {
    const symbols = UNIVERSE.map((i) => i.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it("deckt alle Größenklassen und Indizes ab", () => {
    for (const c of SIZE_CLASSES) {
      expect(UNIVERSE.filter((i) => i.size === c.id).length, c.id).toBeGreaterThan(15);
    }
    expect(UNIVERSE.filter((i) => i.index === "DAX")).toHaveLength(40);
    expect(UNIVERSE.filter((i) => i.index === "MDAX").length).toBeGreaterThan(40);
    expect(UNIVERSE.filter((i) => i.index === "SDAX").length).toBeGreaterThan(35);
    expect(UNIVERSE.filter((i) => i.region === "US").every((i) => i.index === null)).toBe(true);
    expect(UNIVERSE.length).toBeGreaterThan(400);
  });

  it("leitet die Größenklasse aus der Marktkapitalisierung in USD ab", () => {
    expect(sizeClassFor(3000)).toBe("mega");
    expect(sizeClassFor(200)).toBe("mega");
    expect(sizeClassFor(45)).toBe("large");
    expect(sizeClassFor(5)).toBe("mid");
    expect(sizeClassFor(0.4)).toBe("small");
    expect(getInstrument("AAPL")!.size).toBe("mega");
    expect(getInstrument("RGTI")!.size).toBe("mid");
    expect(getInstrument("AMC")!.size).toBe("small");
    // 1,8 Mrd. € ≈ 2,1 Mrd. $ → Mid Cap
    expect(getInstrument("AIXA.DE")!.size).toBe("mid");
    expect(getInstrument("smhn.de")!.size).toBe("small");
  });
});
