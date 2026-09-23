import { beforeAll, describe, expect, it } from "vitest";
import { UNIVERSE, getInstrument } from "@/config/universe";
import { generateInstrument } from "@/lib/providers/mock/generator";
import { clearCache } from "./cache";
import { getChart, getInstrumentDetail, getSnapshot } from "./market";

const NOW = "2026-09-23T18:30:00Z";

beforeAll(() => {
  process.env.MOCK_NOW = NOW;
  clearCache();
});

describe("Mock-Daten", () => {
  it("sind deterministisch", () => {
    const inst = getInstrument("NVDA")!;
    const a = generateInstrument(inst, Date.parse(NOW));
    const b = generateInstrument({ ...inst }, Date.parse(NOW) + 1);
    expect(a.daily.slice(-5)).toEqual(b.daily.slice(-5));
    expect(a.social.daily.slice(-5)).toEqual(b.social.daily.slice(-5));
  });

  it("enden am konfigurierten Kursniveau und haben plausible Werte", () => {
    const data = generateInstrument(getInstrument("AAPL")!, Date.parse(NOW));
    expect(data.daily[data.daily.length - 1]!.c).toBeCloseTo(232, 5);
    for (const c of data.daily) {
      expect(c.h).toBeGreaterThanOrEqual(Math.min(c.o, c.c) - 1e-9);
      expect(c.l).toBeLessThanOrEqual(Math.max(c.o, c.c) + 1e-9);
      expect(c.c).toBeGreaterThan(0);
    }
    expect(data.social.daily.length).toBeGreaterThan(1500);
  });
});

describe("Snapshot", () => {
  it("enthält das gesamte Universum mit Signalen", async () => {
    const snap = await getSnapshot();
    expect(snap.rows).toHaveLength(UNIVERSE.length);
    expect(snap.indices.map((i) => i.id)).toEqual(["SPX", "NDX", "DAX"]);
    expect(snap.status.demo).toBe(true);
    for (const row of snap.rows) {
      expect(row.signal.score).toBeGreaterThanOrEqual(0);
      expect(row.signal.score).toBeLessThanOrEqual(100);
      expect(Number.isFinite(row.price)).toBe(true);
      expect(row.spark.length).toBeGreaterThan(20);
    }
  });

  it("hat eine sinnvolle Verteilung der Scores", async () => {
    const snap = await getSnapshot();
    const scores = snap.rows.map((r) => r.signal.score);
    const flagged = snap.rows.filter((r) => r.signal.flagged).length;
    expect(flagged).toBeGreaterThanOrEqual(10);
    expect(flagged).toBeLessThan(UNIVERSE.length / 2);
    expect(Math.max(...scores)).toBeGreaterThanOrEqual(70);
    const types = new Set(snap.rows.filter((r) => r.signal.flagged).map((r) => r.signal.type));
    expect(types.size).toBeGreaterThanOrEqual(3);
  });

  it("kuratierte Beispiele erzeugen die erwarteten Signale", async () => {
    const snap = await getSnapshot();
    const nvda = snap.rows.find((r) => r.symbol === "NVDA")!;
    expect(nvda.signal.type).toBe("buzz");
    expect(nvda.signal.direction).toBe("bullish");
    const bayer = snap.rows.find((r) => r.symbol === "BAYN.DE")!;
    expect(bayer.signal.direction).toBe("bearish");
  });
});

describe("Detail & Charts", () => {
  it("liefert Detaildaten", async () => {
    const d = await getInstrumentDetail("SAP.DE");
    expect(d).not.toBeNull();
    expect(d!.signal.components).toHaveLength(6);
    expect(d!.discussions.length).toBeGreaterThan(0);
    expect(d!.news.length).toBeGreaterThan(0);
    expect(d!.summary?.method).toBe("lexicon");
    expect(d!.chart.points.length).toBe(22);
  });

  it("unbekanntes Symbol ergibt null", async () => {
    expect(await getInstrumentDetail("NOPE")).toBeNull();
  });

  it.each(["1D", "1W", "1M", "6M", "1Y", "5Y"] as const)("Chart %s hat Punkte und Erwähnungen", async (range) => {
    const c = await getChart("TSLA", range);
    expect(c!.points.length).toBeGreaterThan(10);
    expect(c!.mentions.length).toBeGreaterThan(0);
    const times = new Set(c!.points.map((p) => p.t));
    c!.mentions.forEach((m) => expect(times.has(m.t)).toBe(true));
    const sorted = [...c!.points].sort((a, b) => a.t - b.t);
    expect(sorted).toEqual(c!.points);
    expect(new Set(c!.points.map((p) => p.t)).size).toBe(c!.points.length);
  });
});
