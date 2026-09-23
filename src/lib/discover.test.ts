import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  applyFilters,
  filtersFromParams,
  filtersToParams,
  type DiscoverRow,
} from "./discover";

const row = (over: Partial<DiscoverRow>): DiscoverRow => ({
  symbol: "X",
  ticker: "X",
  name: "X",
  sector: "tech",
  region: "US",
  exchange: "NYSE",
  currency: "USD",
  price: 1,
  d1: 0,
  spark: [],
  mentions: 0,
  buzz: 0,
  sentiment: 0,
  score: 50,
  type: "buzz",
  direction: "neutral",
  highlight: "",
  ...over,
});

const rows = [
  row({ symbol: "A", name: "Alpha", score: 80, buzz: 10, d1: 1, type: "buzz", direction: "bullish" }),
  row({ symbol: "B", name: "Beta", score: 40, buzz: 300, d1: -5, sector: "energy", type: "momentum" }),
  row({ symbol: "C.DE", name: "Cäsar", score: 65, region: "DE", sector: "financials", type: "news", direction: "bearish" }),
];

describe("Entdecken-Filter", () => {
  it("sortiert standardmäßig nach Score", () => {
    expect(applyFilters(rows, DEFAULT_FILTERS).map((r) => r.symbol)).toEqual(["A", "C.DE", "B"]);
  });

  it("filtert nach Sektor, Region, Typ, Mindestscore und Richtung", () => {
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, sectors: ["energy"] }).map((r) => r.symbol)).toEqual(["B"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, region: "DE" }).map((r) => r.symbol)).toEqual(["C.DE"]);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, types: ["buzz", "news"] })).toHaveLength(2);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, minScore: 60 })).toHaveLength(2);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, direction: "bearish" }).map((r) => r.symbol)).toEqual(["C.DE"]);
  });

  it("sortiert nach Buzz, Bewegung und Name", () => {
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, sort: "buzz" })[0]!.symbol).toBe("B");
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, sort: "change" })[0]!.symbol).toBe("B");
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, sort: "name" }).map((r) => r.name)).toEqual(["Alpha", "Beta", "Cäsar"]);
  });

  it("zählt aktive Filter", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, sectors: ["tech", "energy"], minScore: 50 })).toBe(3);
  });

  it("URL-Parameter sind verlustfrei und robust", () => {
    const f = { ...DEFAULT_FILTERS, sectors: ["tech" as const], types: ["news" as const], region: "DE" as const, minScore: 40, sort: "buzz" as const };
    expect(filtersFromParams(filtersToParams(f))).toEqual(f);
    const junk = filtersFromParams(new URLSearchParams("sektor=foo,tech&typ=bar&min=999&sort=evil&region=XX"));
    expect(junk).toEqual({ ...DEFAULT_FILTERS, sectors: ["tech"], minScore: 100 });
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe("");
  });
});
