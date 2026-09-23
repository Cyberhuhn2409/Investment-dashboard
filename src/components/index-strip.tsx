import type { IndexRow } from "@/lib/types";
import { LiveChange, LivePrice } from "./live/live-values";
import { Sparkline } from "./ui/sparkline";

export function IndexStrip({ indices }: { indices: IndexRow[] }) {
  if (indices.length === 0) {
    return (
      <p className="panel mx-4 px-4 py-3 text-sm text-fg-2 lg:mx-0">Indexdaten sind gerade nicht verfügbar.</p>
    );
  }
  return (
    <ul
      className="no-scrollbar relative -mb-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0"
      aria-label="Indizes"
      // Horizontal scrollbar → per Tastatur erreichbar (Pfeiltasten scrollen)
      tabIndex={0}
    >
      {indices.map((idx) => (
        <li key={idx.id} className="panel min-w-[10.5rem] flex-1 snap-start p-3.5 lg:min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="label-mono text-fg-2">{idx.name}</p>
            <span className={`label-mono inline-flex items-center gap-1 ${idx.marketOpen ? "text-up" : "text-fg-3"}`}>
              <span aria-hidden="true" className={`size-1.5 rounded-full ${idx.marketOpen ? "bg-up" : "bg-fg-3"}`} />
              {idx.marketOpen ? "offen" : "zu"}
            </span>
          </div>
          <p className="mt-1.5 text-[1.25rem] font-semibold tracking-tight">
            <LivePrice symbol={idx.id} price={idx.value} plain />
          </p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <LiveChange symbol={idx.id} price={idx.value} changePct={idx.changePct} className="text-[0.8125rem]" />
            <Sparkline
              values={idx.spark}
              width={72}
              height={26}
              area={false}
              baseline={idx.value - idx.change}
              label={`Intraday-Verlauf ${idx.name}`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
