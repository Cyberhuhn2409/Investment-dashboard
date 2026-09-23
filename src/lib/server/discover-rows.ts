import "server-only";
import type { DiscoverRow } from "@/lib/discover";
import { moveHighlight } from "@/lib/relevance";
import type { InstrumentRow } from "@/lib/types";

function downsample(values: number[], n: number): number[] {
  if (values.length <= n) return values;
  const step = (values.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => values[Math.round(i * step)]!);
}

/** Kompakte Zeilen für Entdecken (nur Felder, die Liste und Filter brauchen). */
export function toDiscoverRows(rows: readonly InstrumentRow[]): DiscoverRow[] {
  return rows.map((r) => ({
    symbol: r.symbol,
    ticker: r.ticker,
    name: r.name,
    sector: r.sector,
    region: r.region,
    currency: r.currency,
    size: r.size,
    index: r.index,
    price: r.price,
    d1: Math.round(r.changePct1D * 100) / 100,
    spark: downsample(r.spark, 14).map((v) => Math.round(v * 100) / 100),
    buzz: Math.round(r.buzzChangePct),
    score: r.signal.score,
    type: r.signal.type,
    direction: r.signal.direction,
    highlight: r.relevant && !r.signal.flagged ? moveHighlight(r.changePct1D, r.moveZ) : (r.signal.highlights[0] ?? ""),
    relevant: r.relevant,
    moveZ: Math.round(r.moveZ * 10) / 10,
  }));
}
