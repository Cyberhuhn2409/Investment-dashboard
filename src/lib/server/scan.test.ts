import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UNIVERSE } from "@/config/universe";
import { clearCache } from "./cache";
import { getRows, getSnapshot, scanUniverse } from "./market";

beforeAll(() => {
  process.env.MOCK_NOW = "2026-09-23T18:30:00Z";
  clearCache();
});

afterAll(() => {
  delete process.env.SCAN_UNIVERSE;
  clearCache();
});

describe("Scan-Umfang", () => {
  it("wertet standardmäßig (Demo) das ganze Universum aus", () => {
    delete process.env.SCAN_UNIVERSE;
    expect(scanUniverse()).toHaveLength(UNIVERSE.length);
  });

  it("SCAN_UNIVERSE begrenzt auf Größenklassen, Indizes und Regionen", () => {
    process.env.SCAN_UNIVERSE = "small, DAX";
    const list = scanUniverse();
    expect(list.every((i) => i.size === "small" || i.index === "DAX")).toBe(true);
    expect(list.some((i) => i.index === "DAX" && i.size !== "small")).toBe(true);
    expect(list.some((i) => i.region === "US")).toBe(true);
    process.env.SCAN_UNIVERSE = "DE";
    expect(scanUniverse().every((i) => i.region === "DE")).toBe(true);
    process.env.SCAN_UNIVERSE = "unbekannt";
    expect(scanUniverse()).toHaveLength(UNIVERSE.length);
  });

  it("nicht gescannte Werte sind über getRows trotzdem abrufbar", async () => {
    process.env.SCAN_UNIVERSE = "DAX";
    clearCache();
    const snap = await getSnapshot();
    expect(snap.rows.every((r) => r.index === "DAX")).toBe(true);
    expect(snap.status.coverage).toMatchObject({ total: 40, universe: UNIVERSE.length });
    const { rows } = await getRows(["NVDA", "SAP.DE", "RGTI", "NOPE"]);
    expect(rows.map((r) => r.symbol)).toEqual(["NVDA", "SAP.DE", "RGTI"]);
  });
});
