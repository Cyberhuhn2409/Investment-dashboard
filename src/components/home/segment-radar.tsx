import Link from "next/link";
import { formatInteger, formatPercent } from "@/lib/format";
import type { SegmentStat } from "@/lib/selectors";
import { ChevronRightIcon } from "../icons";
import { ChangeText } from "../ui/change";

function Breadth({ up, down, count }: { up: number; down: number; count: number }) {
  const total = Math.max(1, count);
  return (
    <span className="col-span-full flex items-center gap-2">
      <span className="relative flex h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
        <span className="h-full bg-up" style={{ width: `${(up / total) * 100}%` }} />
        <span className="ml-auto h-full bg-down" style={{ width: `${(down / total) * 100}%` }} />
      </span>
      <span className="tnum shrink-0 text-[0.6875rem] text-fg-2" aria-hidden="true">
        ▲{up} ▼{down}
      </span>
    </span>
  );
}

function Row({ s }: { s: SegmentStat }) {
  return (
    <li>
      <Link
        href={s.href}
        className="press grid grid-cols-[minmax(0,1fr)_auto_4.75rem_1rem] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 hover:bg-surface-2/60"
        aria-label={`${s.label}: ${s.relevant} von ${s.count} Werten relevant, ${s.up} steigend, ${s.down} fallend, im Schnitt ${formatPercent(s.avgChangePct)} – in Entdecken anzeigen`}
      >
        <span className="min-w-0">
          <span className="text-[0.875rem] font-semibold">{s.label}</span>
          <span className="ml-2 text-[0.6875rem] text-fg-2">{s.hint}</span>
        </span>
        <span className="tnum text-right text-[0.8125rem]">
          <span className="font-semibold text-accent">{formatInteger(s.relevant)}</span>
          <span className="text-fg-2">/{formatInteger(s.count)}</span>
        </span>
        <span className="flex justify-end">
          <ChangeText value={s.avgChangePct} arrow={false} className="text-[0.8125rem]" />
        </span>
        <ChevronRightIcon size={15} className="text-fg-3" />
        <Breadth up={s.up} down={s.down} count={s.count} />
      </Link>
    </li>
  );
}

/**
 * Segment-Radar: Wie viele Werte je Größenklasse bzw. Index gerade relevant
 * sind, dazu Marktbreite (steigend/fallend) und Durchschnittsbewegung.
 */
export function SegmentRadar({ sizes, indices }: { sizes: SegmentStat[]; indices: SegmentStat[] }) {
  return (
    <div className="panel mx-4 overflow-hidden lg:mx-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_4.75rem_1rem] gap-x-3 border-b border-line px-4 py-2 text-fg-2" aria-hidden="true">
        <span className="label-mono">Segment · Breite</span>
        <span className="label-mono text-right">Relevant</span>
        <span className="label-mono text-right">Ø Heute</span>
        <span />
      </div>
      <ul className="divide-y divide-line">
        {sizes.map((s) => (
          <Row key={s.id} s={s} />
        ))}
      </ul>
      {indices.length > 0 && (
        <>
          <p className="label-mono border-y border-line bg-surface-2/50 px-4 py-1.5 text-fg-2">Deutschland</p>
          <ul className="divide-y divide-line">
            {indices.map((s) => (
              <Row key={s.id} s={s} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
