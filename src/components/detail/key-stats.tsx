import { sectorLabel } from "@/config/sectors";
import { formatCompact, formatMarketCap, formatNumber, formatPercent, formatPrice } from "@/lib/format";
import type { Fundamentals, InstrumentRow, Quote } from "@/lib/types";

export function KeyStats({ row, quote, fundamentals }: { row: InstrumentRow; quote: Quote; fundamentals: Fundamentals }) {
  const f = fundamentals;
  const stats: [string, string][] = [
    ["Marktkapitalisierung", f.marketCapBn !== null ? formatMarketCap(f.marketCapBn, row.currency) : "–"],
    ["KGV", f.pe !== null && f.pe > 0 ? formatNumber(f.pe, 1) : "n. v."],
    ["Dividendenrendite", f.dividendYieldPct !== null ? formatPercent(f.dividendYieldPct, 2, { sign: false }) : "–"],
    ["Beta", f.beta !== null ? formatNumber(f.beta, 2) : "–"],
    ["52W-Hoch", f.high52w !== null ? formatPrice(f.high52w, row.currency) : "–"],
    ["52W-Tief", f.low52w !== null ? formatPrice(f.low52w, row.currency) : "–"],
    ["Tagesspanne", `${formatNumber(quote.low, 2)} – ${formatNumber(quote.high, 2)}`],
    ["Ø Volumen (60 T.)", f.avgVolume !== null ? formatCompact(f.avgVolume) : "–"],
    ["1 Woche", formatPercent(row.changePct1W, 2)],
    ["1 Monat", formatPercent(row.changePct1M, 2)],
    ["Sektor", sectorLabel(row.sector)],
    ["Börse", `${row.exchange} · ${row.currency}`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] bg-line">
      {stats.map(([k, v]) => (
        <div key={k} className="bg-surface px-4 py-3">
          <dt className="text-[0.75rem] text-fg-2">{k}</dt>
          <dd className="tnum mt-0.5 truncate text-[0.9375rem] font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
