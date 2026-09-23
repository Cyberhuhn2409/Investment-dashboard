"use client";

import Link from "next/link";
import { useState } from "react";
import type { CompactRow, MoverSegment } from "@/lib/selectors";
import { formatNumber } from "@/lib/format";
import { instrumentHref } from "@/lib/view-transition";
import { LiveChange, LivePrice } from "../live/live-values";
import { Monogram } from "../ui/monogram";
import { SegmentedControl } from "../ui/segmented";
import { LinkPending } from "../ui/link-pending";

type Mode = "up" | "down";

const SEGMENTS: { value: MoverSegment; label: string; ariaLabel: string }[] = [
  { value: "all", label: "Alle", ariaLabel: "Alle Größen" },
  { value: "large", label: "Large", ariaLabel: "Mega und Large Caps" },
  { value: "mid", label: "Mid", ariaLabel: "Mid Caps" },
  { value: "small", label: "Small", ariaLabel: "Small Caps" },
];

function MoverRow({ row, rank }: { row: CompactRow; rank: number }) {
  return (
    <li>
      <Link
        href={instrumentHref(row.symbol)}
        transitionTypes={["nav-forward"]}
        className="press relative grid grid-cols-[1.25rem_minmax(0,1fr)_auto_5.25rem] items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60 active:bg-surface-2 sm:grid-cols-[1.25rem_2rem_minmax(0,1fr)_auto_5.25rem]"
      >
        <span className="tnum text-[0.75rem] text-fg-3">
          <span className="sr-only">Platz </span>
          {rank}
        </span>
        <span className="hidden sm:block">
          <Monogram ticker={row.ticker} sector={row.sector} size={32} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[0.9375rem] font-semibold leading-snug">{row.name}</span>
          <span className="flex items-center gap-1.5 text-[0.75rem] text-fg-2">
            <span className="tnum text-accent">{row.ticker}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{row.exchange}</span>
            {Math.abs(row.moveZ) >= 2 && (
              <span className="tnum hidden rounded bg-surface-3 px-1 text-[0.6875rem] text-fg sm:inline" title="Bewegung in Vielfachen der üblichen Tagesschwankung">
                {formatNumber(Math.abs(row.moveZ), 1)}σ
              </span>
            )}
          </span>
        </span>
        <LivePrice symbol={row.symbol} price={row.price} currency={row.currency} className="text-right text-[0.875rem]" />
        <LiveChange symbol={row.symbol} price={row.price} changePct={row.changePct1D} pill className="justify-self-end" />
        <LinkPending />
      </Link>
    </li>
  );
}

function MoverList({ rows, kind }: { rows: CompactRow[]; kind: Mode }) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-[0.875rem] text-fg-2">
        Keine {kind === "up" ? "Gewinner" : "Verlierer"} in diesem Segment.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-line">
      {rows.map((row, i) => (
        <MoverRow key={row.symbol} row={row} rank={i + 1} />
      ))}
    </ol>
  );
}

/**
 * Gewinner und Verlierer je Größenklasse. Mobil umschaltbar, ab lg nebeneinander.
 */
export function Movers({ data }: { data: Record<MoverSegment, { gainers: CompactRow[]; losers: CompactRow[] }> }) {
  const [mode, setMode] = useState<Mode>("up");
  const [segment, setSegment] = useState<MoverSegment>("all");
  const current = data[segment];
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap gap-2 px-4 lg:px-0">
        <SegmentedControl
          label="Gewinner oder Verlierer"
          value={mode}
          onChange={setMode}
          options={[
            { value: "up", label: "Gewinner" },
            { value: "down", label: "Verlierer" },
          ]}
          size="sm"
          className="lg:hidden"
        />
        <SegmentedControl label="Größenklasse" value={segment} onChange={setSegment} options={SEGMENTS} size="sm" />
      </div>
      <div className="panel mx-4 overflow-hidden lg:hidden" aria-live="polite">
        <MoverList rows={mode === "up" ? current.gainers : current.losers} kind={mode} />
      </div>
      <div className="hidden gap-6 lg:grid lg:grid-cols-2" aria-live="polite">
        {(["up", "down"] as const).map((kind) => (
          <div key={kind} className="panel overflow-hidden">
            <p className={`label-mono border-b border-line px-4 py-2 ${kind === "up" ? "text-up" : "text-down"}`}>
              {kind === "up" ? "▲ Gewinner" : "▼ Verlierer"}
            </p>
            <MoverList rows={kind === "up" ? current.gainers : current.losers} kind={kind} />
          </div>
        ))}
      </div>
    </div>
  );
}
