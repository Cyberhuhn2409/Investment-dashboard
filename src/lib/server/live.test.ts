import { beforeAll, describe, expect, it } from "vitest";
import { getInstrument } from "@/config/universe";
import { clearCache } from "./cache";
import { liveIntervalMs, liveMode, liveTicks, resolveLiveKeys } from "./live";
import { getInstrumentDetail, getSnapshot } from "./market";

// Mittwoch 18:30 UTC: US-Börse offen, XETRA geschlossen
const NOW = "2026-09-23T18:30:00Z";

beforeAll(() => {
  process.env.MOCK_NOW = NOW;
  clearCache();
});

describe("Live-Kurse (Demo)", () => {
  it("prüft und normalisiert angefragte Symbole", () => {
    expect(resolveLiveKeys(["nvda", "SAP.DE", "SPX", "FOO", "", "NVDA"])).toEqual(["NVDA", "SAP.DE", "SPX"]);
    expect(resolveLiveKeys(Array.from({ length: 400 }, () => "AAPL"))).toEqual(["AAPL"]);
  });

  it("simuliert Ticks nur für offene Börsen und passt zum Snapshot", async () => {
    expect(liveMode()).toBe("sim");
    expect(liveIntervalMs()).toBe(1000);
    const ticks = await liveTicks(["NVDA", "SAP.DE", "SPX", "DAX"]);
    const by = new Map(ticks.map((t) => [t.s, t]));
    expect(by.get("NVDA")).toMatchObject({ q: "sim", m: 1 });
    expect(by.get("SAP.DE")).toMatchObject({ m: 0 });
    expect(by.get("SPX")?.m).toBe(1);
    expect(by.get("DAX")?.m).toBe(0);

    // Geschlossene Börse: Schlusskurs = Snapshot-Kurs
    const snap = await getSnapshot();
    const sap = snap.rows.find((r) => r.symbol === "SAP.DE")!;
    expect(by.get("SAP.DE")!.p).toBeCloseTo(sap.price, 2);
    // Offene Börse: Live-Kurs nahe am Snapshot-Kurs, Veränderung konsistent
    const nvda = snap.rows.find((r) => r.symbol === "NVDA")!;
    const tick = by.get("NVDA")!;
    expect(Math.abs(tick.p / nvda.price - 1)).toBeLessThan(0.03);
    expect(tick.p - tick.c).toBeCloseTo(nvda.price - nvda.change1D, 1);
  });

  it("Detailseite startet bei offener Börse mit dem Intraday-Chart", async () => {
    const us = await getInstrumentDetail("NVDA");
    expect(us!.chart.range).toBe("1D");
    const de = await getInstrumentDetail(getInstrument("SAP.DE")!.symbol);
    expect(de!.chart.range).toBe("1M");
  });
});
