import Link from "next/link";
import { formatInteger, formatNumber, formatPercent } from "@/lib/format";
import type { InstrumentRow } from "@/lib/types";
import { instrumentHref } from "@/lib/view-transition";
import { Monogram } from "../ui/monogram";
import { LinkPending } from "../ui/link-pending";

export function SentimentMeter({ value, className = "" }: { value: number | null; className?: string }) {
  if (value === null) return <span className={`text-[0.75rem] text-fg-3 ${className}`}>keine Daten</span>;
  const pct = ((value + 1) / 2) * 100;
  const tone = value >= 0.15 ? "positiv" : value <= -0.15 ? "negativ" : "neutral";
  const color = value >= 0.15 ? "bg-up" : value <= -0.15 ? "bg-down" : "bg-fg-3";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="relative h-1.5 w-14 overflow-hidden rounded-full bg-surface-3"
        role="img"
        aria-label={`Stimmung ${tone} (${formatNumber(value, 2, { sign: true })})`}
      >
        <span className="absolute inset-y-0 left-1/2 w-px bg-fg-3/60" aria-hidden="true" />
        <span
          className={`absolute inset-y-0 ${color}`}
          style={value >= 0 ? { left: "50%", width: `${pct - 50}%` } : { left: `${pct}%`, width: `${50 - pct}%` }}
          aria-hidden="true"
        />
      </span>
      <span aria-hidden="true" className="tnum hidden w-[3.2rem] text-[0.75rem] text-fg-2 sm:inline">
        {formatNumber(value, 2, { sign: true })}
      </span>
    </span>
  );
}

export function Trending({ rows }: { rows: InstrumentRow[] }) {
  return (
    <ol className="panel mx-4 divide-y divide-line overflow-hidden lg:mx-0">
      {rows.map((row, i) => (
        <li key={row.symbol}>
          <Link
            href={instrumentHref(row.symbol)}
            transitionTypes={["nav-forward"]}
            className="press relative flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60 active:bg-surface-2"
          >
            <span className="tnum w-5 shrink-0 text-center text-[0.75rem] text-fg-3">
              <span className="sr-only">Platz </span>
              {i + 1}
            </span>
            <Monogram ticker={row.ticker} sector={row.sector} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] font-semibold">{row.name}</p>
              <p className="flex items-center gap-1.5 truncate text-[0.75rem] text-fg-2">
                <span className="tnum text-accent">{row.ticker}</span>
                <span aria-hidden="true">·</span>
                <span className="tnum">{formatInteger(row.mentions24h)}</span> Erwähnungen
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={`tnum text-[0.8125rem] font-semibold ${row.buzzChangePct >= 25 ? "text-accent" : "text-fg-2"}`}
              >
                <span className="sr-only">Veränderung ggü. 30-Tage-Schnitt: </span>
                {formatPercent(row.buzzChangePct, 0)}
              </span>
              <SentimentMeter value={row.sentiment} />
            </div>
            <LinkPending />
          </Link>
        </li>
      ))}
    </ol>
  );
}
