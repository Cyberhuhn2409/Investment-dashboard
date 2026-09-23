import { INDEX_IDS, SIZE_CLASSES } from "@/config/universe";
import type { IndexRow, InstrumentRow } from "./types";

/** Top-Signale mit Vielfalt: höchstens `maxPerType` je Signaltyp. */
export function topSignals(rows: readonly InstrumentRow[], count = 8, maxPerType = 3): InstrumentRow[] {
  const sorted = [...rows].sort((a, b) => b.signal.score - a.signal.score || a.symbol.localeCompare(b.symbol));
  const perType = new Map<string, number>();
  const out: InstrumentRow[] = [];
  for (const row of sorted) {
    const n = perType.get(row.signal.type) ?? 0;
    if (n >= maxPerType) continue;
    perType.set(row.signal.type, n + 1);
    out.push(row);
    if (out.length >= count) break;
  }
  return out;
}

export function movers(rows: readonly InstrumentRow[], count = 5): { gainers: InstrumentRow[]; losers: InstrumentRow[] } {
  const valid = rows.filter((r) => Number.isFinite(r.changePct1D));
  const sorted = [...valid].sort((a, b) => b.changePct1D - a.changePct1D);
  return {
    gainers: sorted.slice(0, count).filter((r) => r.changePct1D > 0),
    losers: sorted.slice(-count).reverse().filter((r) => r.changePct1D < 0),
  };
}

/** Meistdiskutierte Werte (Erwähnungen der letzten 24 Std.). */
export function trending(rows: readonly InstrumentRow[], count = 8): InstrumentRow[] {
  return [...rows].sort((a, b) => b.mentions24h - a.mentions24h).slice(0, count);
}

/* ------------------------------------------------------------------ */
/* Segmente (Größenklassen, Indizes)                                   */
/* ------------------------------------------------------------------ */

export interface SegmentStat {
  id: string;
  label: string;
  hint: string;
  /** Link auf die gefilterte Entdecken-Ansicht */
  href: string;
  count: number;
  relevant: number;
  up: number;
  down: number;
  avgChangePct: number;
  /** Relevantester Wert des Segments */
  top: { symbol: string; ticker: string; score: number } | null;
}

function stat(id: string, label: string, hint: string, href: string, rows: readonly InstrumentRow[]): SegmentStat {
  const valid = rows.filter((r) => Number.isFinite(r.changePct1D));
  const best = [...rows].sort((a, b) => b.signal.score - a.signal.score)[0];
  return {
    id,
    label,
    hint,
    href,
    count: rows.length,
    relevant: rows.filter((r) => r.relevant).length,
    up: valid.filter((r) => r.changePct1D > 0.005).length,
    down: valid.filter((r) => r.changePct1D < -0.005).length,
    avgChangePct: valid.length ? valid.reduce((a, r) => a + r.changePct1D, 0) / valid.length : 0,
    top: best ? { symbol: best.symbol, ticker: best.ticker, score: best.signal.score } : null,
  };
}

/** Kennzahlen je Größenklasse und je deutschem Auswahlindex. */
export function segmentStats(rows: readonly InstrumentRow[]): { sizes: SegmentStat[]; indices: SegmentStat[] } {
  return {
    sizes: SIZE_CLASSES.map((c) =>
      stat(c.id, c.label, c.range, `/entdecken?groesse=${c.id}`, rows.filter((r) => r.size === c.id)),
    ).filter((s) => s.count > 0),
    indices: INDEX_IDS.map((id) => stat(id, id, "XETRA", `/entdecken?index=${id}`, rows.filter((r) => r.index === id))).filter(
      (s) => s.count > 0,
    ),
  };
}

/** Schlanke Zeile für Tabellen auf der Startseite. */
export interface CompactRow {
  symbol: string;
  ticker: string;
  name: string;
  sector: InstrumentRow["sector"];
  exchange: InstrumentRow["exchange"];
  currency: InstrumentRow["currency"];
  size: InstrumentRow["size"];
  price: number;
  changePct1D: number;
  moveZ: number;
  score: number;
  relevant: boolean;
}

export function compactRow(r: InstrumentRow): CompactRow {
  return {
    symbol: r.symbol,
    ticker: r.ticker,
    name: r.name,
    sector: r.sector,
    exchange: r.exchange,
    currency: r.currency,
    size: r.size,
    price: r.price,
    changePct1D: Math.round(r.changePct1D * 100) / 100,
    moveZ: r.moveZ,
    score: r.signal.score,
    relevant: r.relevant,
  };
}

export type MoverSegment = "all" | "large" | "mid" | "small";

/** Gewinner/Verlierer je Segment („large“ = Mega + Large Caps). */
export function moversBySegment(
  rows: readonly InstrumentRow[],
  count = 6,
): Record<MoverSegment, { gainers: CompactRow[]; losers: CompactRow[] }> {
  const pick = (subset: readonly InstrumentRow[]) => {
    const m = movers(subset, count);
    return { gainers: m.gainers.map(compactRow), losers: m.losers.map(compactRow) };
  };
  return {
    all: pick(rows),
    large: pick(rows.filter((r) => r.size === "mega" || r.size === "large")),
    mid: pick(rows.filter((r) => r.size === "mid")),
    small: pick(rows.filter((r) => r.size === "small")),
  };
}

export interface TapeItem {
  key: string;
  label: string;
  name: string;
  price: number;
  changePct: number;
  currency: "USD" | "EUR" | null;
  href: string | null;
}

/** Laufband: Indizes + die relevantesten Werte. */
export function tapeItems(indices: readonly IndexRow[], rows: readonly InstrumentRow[], count = 14): TapeItem[] {
  const idx: TapeItem[] = indices.map((i) => ({
    key: i.id,
    label: i.name,
    name: i.name,
    price: i.value,
    changePct: i.changePct,
    currency: null,
    href: null,
  }));
  const top = [...rows]
    .filter((r) => r.relevant)
    .sort((a, b) => b.signal.score - a.signal.score || Math.abs(b.moveZ) - Math.abs(a.moveZ))
    .slice(0, count)
    .map((r) => ({
      key: r.symbol,
      label: r.ticker,
      name: r.name,
      price: r.price,
      changePct: Math.round(r.changePct1D * 100) / 100,
      currency: r.currency,
      href: `/aktie/${encodeURIComponent(r.symbol)}`,
    }));
  return [...idx, ...top];
}
