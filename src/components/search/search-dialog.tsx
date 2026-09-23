"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { sectorLabel } from "@/config/sectors";
import { UNIVERSE } from "@/config/universe";
import { searchInstruments, toSearchEntries, type SearchEntry } from "@/lib/search";
import { CloseIcon, SearchIcon } from "../icons";
import { Monogram } from "../ui/monogram";

const ENTRIES = toSearchEntries(UNIVERSE);
const BY_SYMBOL = new Map(ENTRIES.map((e) => [e.symbol, e]));
const POPULAR = ["NVDA", "TSLA", "AAPL", "SAP.DE", "RHM.DE", "MSFT"];
const RECENT_KEY = "signal:recent-search";

function readRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && BY_SYMBOL.has(s)).slice(0, 5) : [];
  } catch {
    return [];
  }
}

function pushRecent(symbol: string) {
  try {
    const next = [symbol, ...readRecent().filter((s) => s !== symbol)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignorieren
  }
}

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent] = useState<string[]>(readRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const listId = useId();

  const results: SearchEntry[] = useMemo(() => searchInstruments(ENTRIES, query, 12), [query]);
  const suggestions = useMemo(() => {
    const rec = recent.map((s) => BY_SYMBOL.get(s)).filter((e): e is SearchEntry => Boolean(e));
    const pop = POPULAR.filter((s) => !recent.includes(s))
      .map((s) => BY_SYMBOL.get(s))
      .filter((e): e is SearchEntry => Boolean(e));
    return { recent: rec, popular: pop };
  }, [recent]);
  const items = query.trim() ? results : [...suggestions.recent, ...suggestions.popular];

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  const go = useCallback(
    (entry: SearchEntry | undefined) => {
      if (!entry) return;
      pushRecent(entry.symbol);
      onClose();
      router.push(`/aktie/${encodeURIComponent(entry.symbol)}`);
    },
    [onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === "Tab") {
      // Fokus im Dialog halten
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>("input, button, [href]");
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;

  const renderItem = (entry: SearchEntry, i: number) => (
    <li
      key={entry.symbol}
      id={optionId(i)}
      role="option"
      aria-selected={i === active}
      onMouseEnter={() => setActive(i)}
      onClick={() => go(entry)}
      className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${i === active ? "bg-surface-2" : ""}`}
    >
      <Monogram ticker={entry.ticker} sector={entry.sector} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-medium">{entry.name}</p>
        <p className="truncate text-[0.8125rem] text-fg-2">
          {entry.ticker} · {entry.exchange} · {sectorLabel(entry.sector)}
        </p>
      </div>
    </li>
  );

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]" onKeyDown={onKeyDown}>
          <m.div
            className="absolute inset-0 bg-black/55"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <m.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Aktien suchen"
            className="absolute inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),0.75rem)] flex flex-col overflow-hidden rounded-t-[1.5rem] bg-surface shadow-2xl lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-[12vh] lg:max-h-[70vh] lg:w-[40rem] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-line"
            initial={{ y: "8%", opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: "6%", opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 480, damping: 40 }}
          >
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-surface-3 lg:hidden" aria-hidden="true" />
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <SearchIcon size={20} className="text-fg-2" />
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-expanded={items.length > 0}
                aria-controls={listId}
                aria-activedescendant={items.length > 0 ? optionId(active) : undefined}
                aria-autocomplete="list"
                aria-label="Name, Ticker oder Stichwort"
                placeholder="Name oder Ticker, z. B. SAP oder Nvidia"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                className="min-w-0 flex-1 bg-transparent text-[1.0625rem] outline-none placeholder:text-fg-3 [&::-webkit-search-cancel-button]:hidden"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
              />
              <button
                type="button"
                onClick={onClose}
                className="press rounded-full px-2 py-1 text-[0.9375rem] font-medium text-accent lg:hidden"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Suche schließen"
                className="press hidden size-8 place-items-center rounded-full bg-surface-2 text-fg-2 lg:grid"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2">
              {query.trim() && results.length === 0 ? (
                <div className="px-4 py-12 text-center" role="status">
                  <p className="font-medium">Keine Treffer für „{query.trim()}“</p>
                  <p className="mt-1 text-sm text-fg-2">
                    Signal deckt ~150 US-Large-Caps und den DAX 40 ab. Versuche den Ticker oder einen anderen Namen.
                  </p>
                </div>
              ) : (
                <ul id={listId} role="listbox" aria-label="Suchergebnisse" className="space-y-0.5">
                  {query.trim() ? (
                    results.map(renderItem)
                  ) : (
                    <>
                      {suggestions.recent.length > 0 && (
                        <li role="presentation" className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-fg-2">
                          Zuletzt gesucht
                        </li>
                      )}
                      {suggestions.recent.map((e, i) => renderItem(e, i))}
                      <li role="presentation" className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-fg-2">
                        Beliebt
                      </li>
                      {suggestions.popular.map((e, i) => renderItem(e, suggestions.recent.length + i))}
                    </>
                  )}
                </ul>
              )}
              <p className="sr-only" role="status" aria-live="polite">
                {query.trim() ? `${results.length} Treffer` : ""}
              </p>
            </div>
            <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-xs text-fg-2 lg:flex">
              <span>
                <kbd className="font-sans">↑↓</kbd> auswählen
              </span>
              <span>
                <kbd className="font-sans">↵</kbd> öffnen
              </span>
              <span>
                <kbd className="font-sans">esc</kbd> schließen
              </span>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
