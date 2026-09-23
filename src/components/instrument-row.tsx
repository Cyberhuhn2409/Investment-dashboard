import Link from "next/link";
import { ViewTransition } from "react";
import { formatPrice } from "@/lib/format";
import type { InstrumentRow as Row } from "@/lib/types";
import { instrumentHref, sharedName } from "@/lib/view-transition";
import { ChangePill } from "./ui/change";
import { Monogram } from "./ui/monogram";
import { Sparkline } from "./ui/sparkline";
import { LinkPending } from "./ui/link-pending";

/**
 * Listenzeile für einen Wert. `shared` aktiviert den Shared-Element-Übergang
 * zur Detailseite – nur setzen, wenn das Symbol auf der Seite genau einmal
 * vorkommt.
 */
export function InstrumentRowItem({
  row,
  shared = false,
  meta,
  trailing,
  spark = false,
}: {
  row: Row;
  shared?: boolean;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  spark?: boolean;
}) {
  const mono = <Monogram ticker={row.ticker} sector={row.sector} size={40} />;
  return (
    <Link
      href={instrumentHref(row.symbol)}
      transitionTypes={["nav-forward"]}
      className="press relative flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60 active:bg-surface-2"
    >
      {shared ? (
        <ViewTransition name={sharedName("logo", row.symbol)} share="morph" default="none">
          {mono}
        </ViewTransition>
      ) : (
        mono
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-semibold leading-snug">{row.name}</p>
        <p className="truncate text-[0.8125rem] text-fg-2">{meta ?? `${row.ticker} · ${row.exchange}`}</p>
      </div>
      {spark && (
        <Sparkline values={row.spark} width={64} height={28} className="hidden shrink-0 sm:block" baseline={row.spark[0]} />
      )}
      <LinkPending />
      {trailing ?? (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="tnum text-[0.9375rem] font-medium">{formatPrice(row.price, row.currency)}</span>
          <ChangePill value={row.changePct1D} />
        </div>
      )}
    </Link>
  );
}
