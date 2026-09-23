"use client";

import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { ViewTransition, useCallback, useEffect, useMemo, useState } from "react";
import { sectorLabel } from "@/config/sectors";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  applyFilters,
  filtersFromParams,
  filtersToParams,
  type DiscoverRow,
  type Filters,
} from "@/lib/discover";
import { formatPrice } from "@/lib/format";
import { instrumentHref, sharedName } from "@/lib/view-transition";
import { FilterIcon } from "../icons";
import { DirectionBadge, SignalTypeBadge } from "../ui/badges";
import { ChangeText } from "../ui/change";
import { Monogram } from "../ui/monogram";
import { ScoreRing } from "../ui/score-ring";
import { Sheet } from "../ui/sheet";
import { Sparkline } from "../ui/sparkline";
import { FilterPanel, TypeChips } from "./filter-panel";

const PAGE = 40;

export function DiscoverList({ rows }: { rows: DiscoverRow[] }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  // Filter aus der URL übernehmen (teilbare Links) …
  useEffect(() => {
    const f = filtersFromParams(new URLSearchParams(window.location.search));
    if (activeFilterCount(f) > 0 || f.sort !== "score") setFilters(f);
  }, []);

  // … und Änderungen in die URL zurückschreiben.
  const update = useCallback((next: Filters) => {
    setFilters(next);
    setLimit(PAGE);
    const qs = filtersToParams(next).toString();
    window.history.replaceState(window.history.state, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  const result = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const visible = result.slice(0, limit);
  const count = activeFilterCount(filters);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
      <div className="min-w-0">
        <div className="no-scrollbar relative flex items-center gap-2 overflow-x-auto px-4 pb-1 lg:px-0">
          <button
            type="button"
            onClick={() => setSheet(true)}
            className={`press inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium lg:hidden ${
              count > 0 ? "bg-accent text-on-accent" : "bg-surface-2 text-fg"
            }`}
            aria-label={`Filter öffnen${count > 0 ? ` (${count} aktiv)` : ""}`}
          >
            <FilterIcon size={16} />
            Filter{count > 0 ? ` · ${count}` : ""}
          </button>
          <TypeChips filters={filters} onChange={update} />
        </div>

        <div className="mt-3 flex items-center justify-between px-4 text-[0.8125rem] text-fg-2 lg:px-0" role="status" aria-live="polite">
          <span>
            <span className="tnum font-semibold text-fg">{result.length}</span> {result.length === 1 ? "Wert" : "Werte"}
            {filters.minScore > 0 && ` · Score ≥ ${filters.minScore}`}
          </span>
          {count > 0 && (
            <button type="button" onClick={() => update(DEFAULT_FILTERS)} className="font-medium text-accent">
              Zurücksetzen
            </button>
          )}
        </div>

        {result.length === 0 ? (
          <div className="mx-4 mt-3 rounded-[var(--radius-card)] bg-surface px-6 py-12 text-center lg:mx-0">
            <FilterIcon size={30} className="mx-auto text-fg-3" />
            <p className="mt-3 text-[1.0625rem] font-semibold">Keine Signale für diese Filter</p>
            <p className="mt-1 text-[0.9375rem] text-fg-2">Senke den Mindest-Score oder entferne einzelne Filter.</p>
            <button
              type="button"
              onClick={() => update(DEFAULT_FILTERS)}
              className="press mt-5 rounded-full bg-accent px-5 py-2.5 font-medium text-on-accent"
            >
              Filter zurücksetzen
            </button>
          </div>
        ) : (
          <ul className="mx-4 mt-3 overflow-hidden rounded-[var(--radius-card)] bg-surface lg:mx-0">
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
                  <Link
                    href={instrumentHref(r.symbol)}
                    transitionTypes={["nav-forward"]}
                    className="press relative flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60 active:bg-surface-2"
                  >
                    <ViewTransition name={sharedName("logo", r.symbol)} share="morph" default="none">
                      <Monogram ticker={r.ticker} sector={r.sector} size={40} />
                    </ViewTransition>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <ViewTransition name={sharedName("title", r.symbol)} share="morph" default="none">
                          <p className="truncate text-[0.9375rem] font-semibold">{r.name}</p>
                        </ViewTransition>
                        <span className="hidden shrink-0 text-[0.75rem] text-fg-2 sm:inline">
                          {r.ticker} · {sectorLabel(r.sector)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <SignalTypeBadge type={r.type} />
                        <DirectionBadge direction={r.direction} className="hidden sm:inline-flex" />
                      </div>
                      <p className="mt-1 truncate text-[0.8125rem] text-fg-2">{r.highlight}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Sparkline
                        values={r.spark}
                        width={56}
                        height={26}
                        baseline={r.spark[0]}
                        label={`30-Tage-Verlauf ${r.name}`}
                        className="sm:hidden"
                      />
                      <Sparkline
                        values={r.spark}
                        width={84}
                        height={30}
                        baseline={r.spark[0]}
                        label={`30-Tage-Verlauf ${r.name}`}
                        className="hidden sm:block"
                      />
                      <span className="tnum hidden text-[0.75rem] text-fg-2 sm:inline">{formatPrice(r.price, r.currency)}</span>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      <ScoreRing score={r.score} size={40} stroke={3.5} />
                      <ChangeText value={r.d1} className="text-[0.75rem]" arrow={false} />
                    </div>
                  </Link>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        {result.length > limit && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="press rounded-full bg-surface-2 px-5 py-2.5 text-[0.9375rem] font-medium"
            >
              Weitere {Math.min(PAGE, result.length - limit)} anzeigen
            </button>
          </div>
        )}
      </div>

      <aside className="hidden lg:block" aria-label="Filter">
        <div className="sticky top-6 rounded-[var(--radius-card)] bg-surface p-5">
          <FilterPanel filters={filters} onChange={update} />
        </div>
      </aside>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filter"
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => update(DEFAULT_FILTERS)}
              className="press flex-1 rounded-full bg-surface-2 py-3 font-medium"
            >
              Zurücksetzen
            </button>
            <button
              type="button"
              onClick={() => setSheet(false)}
              className="press flex-[2] rounded-full bg-accent py-3 font-medium text-on-accent"
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
