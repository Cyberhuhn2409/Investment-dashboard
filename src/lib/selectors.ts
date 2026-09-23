import type { InstrumentRow } from "./types";

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
