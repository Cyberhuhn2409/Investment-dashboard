import { SECTORS, isSectorId, type SectorId } from "@/config/sectors";
import { SIGNAL_TYPES, type SignalType } from "@/config/signals";
import type { SignalDirection } from "@/lib/scoring/types";

/** Kompakte Zeile für die Entdecken-Liste. */
export interface DiscoverRow {
  symbol: string;
  ticker: string;
  name: string;
  sector: SectorId;
  region: "US" | "DE";
  exchange: string;
  currency: "USD" | "EUR";
  price: number;
  d1: number;
  spark: number[];
  mentions: number;
  buzz: number;
  sentiment: number | null;
  score: number;
  type: SignalType;
  direction: SignalDirection;
  highlight: string;
}

export type SortKey = "score" | "buzz" | "change" | "name";
export type RegionFilter = "ALL" | "US" | "DE";
export type DirectionFilter = "ALL" | SignalDirection;

export interface Filters {
  sectors: SectorId[];
  region: RegionFilter;
  types: SignalType[];
  minScore: number;
  direction: DirectionFilter;
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = {
  sectors: [],
  region: "ALL",
  types: [],
  minScore: 0,
  direction: "ALL",
  sort: "score",
};

export function applyFilters(rows: readonly DiscoverRow[], f: Filters): DiscoverRow[] {
  const out = rows.filter(
    (r) =>
      (f.sectors.length === 0 || f.sectors.includes(r.sector)) &&
      (f.region === "ALL" || r.region === f.region) &&
      (f.types.length === 0 || f.types.includes(r.type)) &&
      r.score >= f.minScore &&
      (f.direction === "ALL" || r.direction === f.direction),
  );
  const cmp: Record<SortKey, (a: DiscoverRow, b: DiscoverRow) => number> = {
    score: (a, b) => b.score - a.score,
    buzz: (a, b) => b.buzz - a.buzz,
    change: (a, b) => Math.abs(b.d1) - Math.abs(a.d1),
    name: (a, b) => a.name.localeCompare(b.name, "de"),
  };
  return out.sort((a, b) => cmp[f.sort](a, b) || a.symbol.localeCompare(b.symbol));
}

export function activeFilterCount(f: Filters): number {
  return (
    f.sectors.length +
    f.types.length +
    (f.region !== "ALL" ? 1 : 0) +
    (f.minScore > 0 ? 1 : 0) +
    (f.direction !== "ALL" ? 1 : 0)
  );
}

const TYPE_IDS = new Set<string>(SIGNAL_TYPES.map((t) => t.id));
const SORTS = new Set<SortKey>(["score", "buzz", "change", "name"]);

export function filtersFromParams(params: URLSearchParams): Filters {
  const sectors = (params.get("sektor") ?? "").split(",").filter(isSectorId);
  const types = (params.get("typ") ?? "").split(",").filter((t): t is SignalType => TYPE_IDS.has(t));
  const region = params.get("region");
  const dir = params.get("richtung");
  const min = Number(params.get("min") ?? "0");
  const sort = params.get("sort") as SortKey | null;
  return {
    sectors,
    types,
    region: region === "US" || region === "DE" ? region : "ALL",
    direction: dir === "bullish" || dir === "bearish" || dir === "neutral" ? dir : "ALL",
    minScore: Number.isFinite(min) ? Math.max(0, Math.min(100, Math.round(min))) : 0,
    sort: sort && SORTS.has(sort) ? sort : "score",
  };
}

export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.sectors.length) p.set("sektor", f.sectors.join(","));
  if (f.types.length) p.set("typ", f.types.join(","));
  if (f.region !== "ALL") p.set("region", f.region);
  if (f.direction !== "ALL") p.set("richtung", f.direction);
  if (f.minScore > 0) p.set("min", String(f.minScore));
  if (f.sort !== "score") p.set("sort", f.sort);
  return p;
}

export const SECTOR_OPTIONS = SECTORS.map((s) => ({ id: s.id, label: s.label }));
