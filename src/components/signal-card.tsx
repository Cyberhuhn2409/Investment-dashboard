import Link from "next/link";
import { ViewTransition } from "react";
import type { InstrumentRow } from "@/lib/types";
import { instrumentHref, sharedName } from "@/lib/view-transition";
import { DirectionBadge, SignalTypeBadge } from "./ui/badges";
import { LiveChange, LivePrice } from "./live/live-values";
import { Monogram } from "./ui/monogram";
import { ScoreRing } from "./ui/score-ring";
import { Sparkline } from "./ui/sparkline";
import { LinkPending } from "./ui/link-pending";

/** Karte für ein Top-Signal (Start). Monogramm + Titel morphen in den Detail-Kopf. */
export function SignalCard({ row, className = "" }: { row: InstrumentRow; className?: string }) {
  return (
    <Link
      href={instrumentHref(row.symbol)}
      transitionTypes={["nav-forward"]}
      className={`panel press group relative flex flex-col p-4 hover:border-line-strong hover:bg-surface-2/60 ${className}`}
      aria-label={`${row.name}: Signal-Score ${row.signal.score}, ${row.signal.headline}`}
    >
      <LinkPending />
      <div className="flex items-start gap-3">
        <ViewTransition name={sharedName("logo", row.symbol)} share="morph" default="none">
          <Monogram ticker={row.ticker} sector={row.sector} size={44} />
        </ViewTransition>
        <div className="min-w-0 flex-1">
          <ViewTransition name={sharedName("title", row.symbol)} share="morph" default="none">
            <p className="truncate text-[1rem] font-semibold leading-snug">{row.name}</p>
          </ViewTransition>
          <p className="flex items-center gap-1.5 text-[0.8125rem] text-fg-2">
            <span className="tnum text-accent">{row.ticker}</span>
            <span aria-hidden="true">·</span>
            {row.exchange}
          </p>
        </div>
        <ScoreRing score={row.signal.score} size={46} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <SignalTypeBadge type={row.signal.type} />
        <DirectionBadge direction={row.signal.direction} />
      </div>

      <ul className="mt-2.5 min-h-[2.75rem] space-y-0.5 text-[0.875rem] leading-snug text-fg-2">
        {row.signal.highlights.map((h) => (
          <li key={h} className="flex gap-1.5">
            <span aria-hidden="true" className="text-fg-3">
              •
            </span>
            <span className="line-clamp-1">{h}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <div>
          <p className="text-[1.0625rem] font-semibold">
            <LivePrice symbol={row.symbol} price={row.price} currency={row.currency} />
          </p>
          <LiveChange symbol={row.symbol} price={row.price} changePct={row.changePct1D} className="text-[0.8125rem]" />
        </div>
        <Sparkline values={row.spark} width={104} height={36} baseline={row.spark[0]} />
      </div>
    </Link>
  );
}
