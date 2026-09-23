"use client";

import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { ViewTransition, useCallback, useEffect, useMemo, useState } from "react";
import { sectorShort } from "@/config/sectors";
import { SIZE_CLASSES } from "@/config/universe";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  applyFilters,
  filtersFromParams,
  filtersToParams,
  scopeCounts,
  type DiscoverRow,
  type Filters,
  type Scope,
  type SortKey,
} from "@/lib/discover";
import { formatPercent } from "@/lib/format";
import { instrumentHref, sharedName } from "@/lib/view-transition";
import { FilterIcon } from "../icons";
import { LiveChange, LivePrice } from "../live/live-values";
import { DirectionBadge, SignalTypeBadge } from "../ui/badges";
import { Monogram } from "../ui/monogram";
import { ScoreRing } from "../ui/score-ring";
import { SegmentedControl } from "../ui/segmented";
import { Sheet } from "../ui/sheet";
import { Sparkline } from "../ui/sparkline";
import { LinkPending } from "../ui/link-pending";
import { FilterPanel, SegmentChips } from "./filter-panel";

const PAGE = 50;
const SIZE_SHORT = new Map(SIZE_CLASSES.map((c) => [c.id, c.short]));

/**
 * Spalten je nach verfügbarer Breite (Container Queries): schmal wie eine
 * iOS-Liste, ab 42rem als Tabelle (Kurs | Heute | Score | Signal), ab 64rem
 * zusätzlich Buzz und 30-Tage-Verlauf.
 */
const GRID =
  "grid grid-cols-[2.25rem_minmax(0,1fr)_auto_2.5rem] items-center gap-x-3 @2xl:grid-cols-[2.25rem_minmax(0,1fr)_6.5rem_5.5rem_2.75rem_8.75rem] @5xl:grid-cols-[2.25rem_minmax(0,1fr)_6.5rem_5.5rem_2.75rem_8.75rem_4.25rem_5.5rem]";

function SortHeader({ filters, onSort }: { filters: Filters; onSort: (s: SortKey) => void }) {
  const col = (label: string, key: SortKey | null, align: "left" | "right" | "center" = "left") => {
    const cls = `label-mono ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`;
    if (!key) return <span className={`${cls} text-fg-2`}>{label}</span>;
    const active = filters.sort === key;
    return (
      <button
        type="button"
        onClick={() => onSort(key)}
        aria-pressed={active}
        aria-label={`Nach ${label} sortieren`}
        className={`${cls} rounded px-0.5 hover:text-fg ${active ? "text-accent" : "text-fg-2"}`}
      >
        {label}
        {active && <span aria-hidden="true"> ▾</span>}
      </button>
    );
  };
  return (
    <div className={`${GRID} !hidden border-b border-line px-4 py-2 @2xl:!grid`} role="group" aria-label="Sortierung">
      <span />
      {col("Wert", "name")}
      <span className="label-mono text-right text-fg-2">Kurs</span>
      {col("Heute", "change", "right")}
      {col("Score", "score", "center")}
      <span className="label-mono text-fg-2">Signal</span>
      <span className="hidden text-right @5xl:block">{col("Buzz", "buzz", "right")}</span>
      <span className="label-mono hidden text-right text-fg-2 @5xl:block">30 Tage</span>
    </div>
  );
}

function Row({ r }: { r: DiscoverRow }) {
  return (
    <Link
      href={instrumentHref(r.symbol)}
      transitionTypes={["nav-forward"]}
      className={`${GRID} press relative px-4 py-2.5 hover:bg-surface-2/60 active:bg-surface-2`}
    >
      <ViewTransition name={sharedName("logo", r.symbol)} share="morph" default="none">
        <Monogram ticker={r.ticker} sector={r.sector} size={36} />
      </ViewTransition>
      <div className="min-w-0">
        <ViewTransition name={sharedName("title", r.symbol)} share="morph" default="none">
          <p className="truncate text-[0.9375rem] font-semibold leading-snug">{r.name}</p>
        </ViewTransition>
        <p className="flex min-w-0 items-center gap-1.5 text-[0.75rem] text-fg-2">
          <span className="tnum text-accent">{r.ticker}</span>
          <span aria-hidden="true">·</span>
          <span>{SIZE_SHORT.get(r.size)}</span>
          {r.index && (
            <>
              <span aria-hidden="true">·</span>
              <span>{r.index}</span>
            </>
          )}
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <span className="hidden truncate sm:inline">{sectorShort(r.sector)}</span>
        </p>
        <div className="mt-1 flex items-center gap-1.5 @2xl:hidden">
          <SignalTypeBadge type={r.type} />
        </div>
        <p className="mt-0.5 truncate text-[0.75rem] text-fg-2 @2xl:mt-0">{r.highlight}</p>
      </div>
      <div className="flex flex-col items-end gap-1 @2xl:contents">
        <LivePrice symbol={r.symbol} price={r.price} currency={r.currency} className="text-right text-[0.875rem] @2xl:justify-self-end" />
        <LiveChange symbol={r.symbol} price={r.price} changePct={r.d1} pill className="justify-self-end" />
      </div>
      <ScoreRing score={r.score} size={38} stroke={3.5} className="justify-self-center" />
      <div className="hidden min-w-0 flex-col items-start gap-1 @2xl:flex">
        <SignalTypeBadge type={r.type} />
        <DirectionBadge direction={r.direction} />
      </div>
      <span className="tnum hidden text-right text-[0.8125rem] @5xl:block">
        <span className="sr-only">Buzz </span>
        {formatPercent(r.buzz, 0)}
      </span>
      <Sparkline
        values={r.spark}
        width={84}
        height={28}
        baseline={r.spark[0]}
        label={`30-Tage-Verlauf ${r.name}`}
        className="hidden justify-self-end @5xl:block"
      />
      <LinkPending />
    </Link>
  );
}

export function DiscoverList({ rows }: { rows: DiscoverRow[] }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  // Filter aus der URL übernehmen (teilbare Links) …
  useEffect(() => {
    const f = filtersFromParams(new URLSearchParams(window.location.search));
    // Einmalige Übernahme aus einem externen System (URL) nach der Hydration – bewusst im Effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (filtersToParams(f).toString()) setFilters(f);
  }, []);

  // … und Änderungen in die URL zurückschreiben.
  const update = useCallback((next: Filters) => {
    setFilters(next);
    setLimit(PAGE);
    const qs = filtersToParams(next).toString();
    window.history.replaceState(window.history.state, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  const result = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const counts = useMemo(() => scopeCounts(rows, filters), [rows, filters]);
  const visible = result.slice(0, limit);
  const count = activeFilterCount(filters);
  const reset = () => update({ ...DEFAULT_FILTERS, scope: filters.scope });

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_16rem] xl:gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 px-4 lg:px-0">
          <SegmentedControl<Scope>
            label="Ansicht"
            value={filters.scope}
            onChange={(scope) => update({ ...filters, scope })}
            options={[
              { value: "relevant", label: `Relevant · ${counts.relevant}`, ariaLabel: `Nur relevante Werte (${counts.relevant})` },
              { value: "all", label: `Alle · ${counts.all}`, ariaLabel: `Alle Werte (${counts.all})` },
            ]}
          />
          <button
            type="button"
            onClick={() => setSheet(true)}
            className={`press inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium xl:hidden ${
              count > 0 ? "bg-accent text-on-accent" : "bg-surface-2 text-fg"
            }`}
            aria-label={`Filter öffnen${count > 0 ? ` (${count} aktiv)` : ""}`}
          >
            <FilterIcon size={16} />
            Filter{count > 0 ? ` · ${count}` : ""}
          </button>
        </div>
        <div className="no-scrollbar relative mt-2.5 flex items-center gap-2 overflow-x-auto px-4 pb-1 lg:px-0" role="group" aria-label="Größe und Index">
          <SegmentChips filters={filters} onChange={update} />
        </div>

        <div className="mt-3 flex items-center justify-between px-4 text-[0.8125rem] text-fg-2 lg:px-0" role="status" aria-live="polite">
          <span>
            <span className="tnum font-semibold text-fg">{result.length}</span>{" "}
            {filters.scope === "relevant" ? (result.length === 1 ? "relevanter Wert" : "relevante Werte") : result.length === 1 ? "Wert" : "Werte"}
            {filters.minScore > 0 && ` · Score ≥ ${filters.minScore}`}
            {filters.scope === "relevant" && (
              <span className="hidden sm:inline"> · Score ≥ 60 oder Tagesbewegung ≥ 2,5σ</span>
            )}
          </span>
          {count > 0 && (
            <button type="button" onClick={reset} className="font-medium text-accent">
              Zurücksetzen
            </button>
          )}
        </div>

        {result.length === 0 ? (
          <div className="panel mx-4 mt-3 px-6 py-12 text-center lg:mx-0">
            <FilterIcon size={30} className="mx-auto text-fg-3" />
            <p className="mt-3 text-[1.0625rem] font-semibold">
              {filters.scope === "relevant" && counts.all > 0 ? "Gerade nichts Auffälliges" : "Keine Werte für diese Filter"}
            </p>
            <p className="mt-1 text-[0.9375rem] text-fg-2">
              {filters.scope === "relevant" && counts.all > 0
                ? `In dieser Auswahl ist aktuell kein Wert relevant. ${counts.all} Werte passen zu den Filtern.`
                : "Senke den Mindest-Score oder entferne einzelne Filter."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {filters.scope === "relevant" && counts.all > 0 && (
                <button
                  type="button"
                  onClick={() => update({ ...filters, scope: "all" })}
                  className="press rounded-lg bg-accent px-4 py-2.5 font-medium text-on-accent"
                >
                  Alle {counts.all} anzeigen
                </button>
              )}
              <button type="button" onClick={() => update(DEFAULT_FILTERS)} className="press rounded-lg bg-surface-2 px-4 py-2.5 font-medium">
                Filter zurücksetzen
              </button>
            </div>
          </div>
        ) : (
          <div className="panel @container mx-4 mt-3 overflow-hidden lg:mx-0">
            <SortHeader filters={filters} onSort={(sort) => update({ ...filters, sort })} />
            <ul>
              <AnimatePresence initial={false}>
                {visible.map((r) => (
                  <m.li
                    key={r.symbol}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    transition={{ type: "spring", stiffness: 500, damping: 42 }}
                    className="border-b border-line last:border-b-0"
                  >
                    <Row r={r} />
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        )}
        {result.length > limit && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="press rounded-lg bg-surface-2 px-5 py-2.5 text-[0.9375rem] font-medium"
            >
              Weitere {Math.min(PAGE, result.length - limit)} von {result.length - limit} anzeigen
            </button>
          </div>
        )}
      </div>

      <aside className="hidden xl:block" aria-label="Filter">
        <div className="panel sticky top-12 max-h-[calc(100dvh-4rem)] overflow-y-auto p-5">
          <FilterPanel filters={filters} onChange={update} />
        </div>
      </aside>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filter"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={reset} className="press flex-1 rounded-lg bg-surface-2 py-3 font-medium">
              Zurücksetzen
            </button>
            <button
              type="button"
              onClick={() => setSheet(false)}
              className="press flex-[2] rounded-lg bg-accent py-3 font-medium text-on-accent"
            >
              {result.length} {result.length === 1 ? "Ergebnis" : "Ergebnisse"} anzeigen
            </button>
          </div>
        }
      >
        <FilterPanel filters={filters} onChange={update} />
      </Sheet>
    </div>
  );
}
