import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  applyFilters,
  filtersFromParams,
  filtersToParams,
  scopeCounts,
  type DiscoverRow,
} from "./discover";

const row = (over: Partial<DiscoverRow>): DiscoverRow => ({
  symbol: "X",
  ticker: "X",
  name: "X",
  sector: "tech",
  region: "US",
  currency: "USD",
  size: "large",
  index: null,
  price: 1,
  d1: 0,
  spark: [],
  buzz: 0,
  score: 50,
  type: "buzz",
  direction: "neutral",
  highlight: "",
  relevant: true,
  moveZ: 0,
  ...over,
});

const rows = [
  row({ symbol: "A", name: "Alpha", score: 80, buzz: 10, d1: 1, type: "buzz", direction: "bullish" }),
  row({ symbol: "B", name: "Beta", score: 40, buzz: 300, d1: -5, sector: "energy", type: "momentum" }),
  row({ symbol: "C.DE", name: "Cäsar", score: 65, region: "DE", sector: "financials", type: "news", direction: "bearish" }),
];

describe("Entdecken-Filter", () => {
  const universe = [
    ...rows,
    row({ symbol: "S", name: "Small", size: "small", score: 20, relevant: false }),
    row({ symbol: "M.DE", name: "Mdax", size: "mid", region: "DE", index: "MDAX", score: 30, relevant: true, moveZ: 3 }),
  ];

  it("zeigt standardmäßig nur relevante Werte, auf Wunsch alle", () => {
    expect(applyFilters(universe, DEFAULT_FILTERS).map((r) => r.symbol)).not.toContain("S");
    expect(applyFilters(universe, { ...DEFAULT_FILTERS, scope: "all" }).map((r) => r.symbol)).toContain("S");
    expect(scopeCounts(universe, DEFAULT_FILTERS)).toEqual({ all: 5, relevant: 4 });
    expect(scopeCounts(universe, { ...DEFAULT_FILTERS, sizes: ["small"] })).toEqual({ all: 1, relevant: 0 });
  });

  it("filtert nach Größenklasse und Index", () => {
    expect(applyFilters(universe, { ...DEFAULT_FILTERS, scope: "all", sizes: ["small", "mid"] }).map((r) => r.symbol)).toEqual([
      "M.DE",
      "S",
    ]);
    expect(applyFilters(universe, { ...DEFAULT_FILTERS, indices: ["MDAX"] }).map((r) => r.symbol)).toEqual(["M.DE"]);
  });

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
    const f = {
      ...DEFAULT_FILTERS,
      scope: "all" as const,
      sizes: ["mid" as const, "small" as const],
      indices: ["SDAX" as const],
      sectors: ["tech" as const],
      types: ["news" as const],
      region: "DE" as const,
      minScore: 40,
      sort: "buzz" as const,
    };
    expect(filtersFromParams(filtersToParams(f))).toEqual(f);
    expect(filtersFromParams(new URLSearchParams("groesse=mid,huge&index=mdax,FOO"))).toMatchObject({ sizes: ["mid"], indices: ["MDAX"] });
    const junk = filtersFromParams(new URLSearchParams("sektor=foo,tech&typ=bar&min=999&sort=evil&region=XX"));
    expect(junk).toEqual({ ...DEFAULT_FILTERS, sectors: ["tech"], minScore: 100 });
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe("");
  });
});
