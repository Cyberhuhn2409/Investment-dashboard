"use client";

import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useState } from "react";
import { formatPercent, formatPrice } from "@/lib/format";
import type { DataStatus, InstrumentRow } from "@/lib/types";
import { useHydrated, useWatchlist } from "@/lib/watchlist";
import { AlertIcon, RefreshIcon, StarIcon } from "../icons";
import { DataStatusLine, StaleBanner } from "../data-status";
import { InstrumentRowItem } from "../instrument-row";
import { SignalTypeBadge } from "../ui/badges";
import { ChangePill } from "../ui/change";
import { Monogram } from "../ui/monogram";
import { ScoreRing } from "../ui/score-ring";
import { LoadingAnnouncement, SkeletonList } from "../ui/skeleton";

type Result =
  | { key: string; kind: "error"; message: string }
  | { key: string; kind: "ready"; rows: InstrumentRow[]; status: DataStatus };

export function WatchlistView({ suggestions }: { suggestions: InstrumentRow[] }) {
  const hydrated = useHydrated();
  const { symbols, remove, add } = useWatchlist();
  const [result, setResult] = useState<Result | null>(null);
  const [lastReady, setLastReady] = useState<Extract<Result, { kind: "ready" }> | null>(null);
  const [editing, setEditing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const key = symbols.join(",");

  useEffect(() => {
    if (!hydrated || key === "") return;
    const ctrl = new AbortController();
    fetch(`/api/rows?symbols=${encodeURIComponent(key)}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Kurse konnten nicht geladen werden.");
        const json = (await res.json()) as { rows: InstrumentRow[]; status: DataStatus };
        const ready = { key, kind: "ready" as const, rows: json.rows, status: json.status };
        setResult(ready);
        setLastReady(ready);
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setResult({ key, kind: "error", message: (e as Error).message });
      });
    return () => ctrl.abort();
  }, [hydrated, key, attempt]);

  // Während eines Neuladens (z. B. nach dem Entfernen) die letzte Liste weiter zeigen.
  const current = result?.key === key ? result : null;
  const state = current ?? (lastReady ? { ...lastReady } : null);

  if (!hydrated) {
    return (
      <div className="px-4 lg:px-0">
        <LoadingAnnouncement label="Watchlist wird geladen" />
        <SkeletonList rows={4} />
      </div>
    );
  }

  if (symbols.length === 0) {
    return (
      <div className="px-4 lg:px-0">
        <div className="rounded-[var(--radius-card)] bg-surface px-6 py-10 text-center">
          <m.div
            initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent"
          >
            <StarIcon size={30} />
          </m.div>
          <h2 className="mt-4 text-[1.25rem] font-semibold">Deine Watchlist ist leer</h2>
          <p className="mx-auto mt-1 max-w-xs text-[0.9375rem] text-fg-2">
            Tippe auf den Stern bei einem Wert, um ihn hier zu verfolgen. Die Liste bleibt nur auf diesem Gerät gespeichert.
          </p>
          <Link
            href="/entdecken"
            className="press mt-5 inline-flex rounded-full bg-accent px-5 py-2.5 font-medium text-on-accent"
          >
            Signale entdecken
          </Link>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[1.0625rem] font-semibold">Vorschläge</h2>
            <p className="text-[0.875rem] text-fg-2">Aktuell auffällige Werte – mit einem Tipp hinzufügen</p>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface">
              {suggestions.map((r) => (
                <li key={r.symbol} className="flex items-center gap-3 px-4 py-3">
                  <Monogram ticker={r.ticker} sector={r.sector} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-semibold">{r.name}</p>
                    <SignalTypeBadge type={r.signal.type} className="mt-1" />
                  </div>
                  <ScoreRing score={r.signal.score} size={38} stroke={3.5} />
                  <button
                    type="button"
                    onClick={() => add(r.symbol)}
                    className="press grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-[1.375rem] font-medium leading-none text-accent"
                    aria-label={`${r.name} zur Watchlist hinzufügen`}
                  >
                    +
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (state?.kind === "error") {
    return (
      <div role="alert" className="mx-4 rounded-[var(--radius-card)] bg-surface px-6 py-10 text-center lg:mx-0">
        <AlertIcon size={28} className="mx-auto text-warn" />
        <p className="mt-2 font-semibold">{state.message}</p>
        <p className="mt-1 text-sm text-fg-2">Deine Watchlist ist sicher gespeichert – nur die Kurse fehlen gerade.</p>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setAttempt((n) => n + 1);
          }}
          className="press mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-on-accent"
        >
          <RefreshIcon size={18} />
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!state || state.kind !== "ready") {
    return (
      <div className="px-4 lg:px-0">
        <LoadingAnnouncement label="Kurse werden geladen" />
        <SkeletonList rows={Math.min(symbols.length, 6)} />
      </div>
    );
  }

  // Reihenfolge der Watchlist beibehalten
  const bySymbol = new Map(state.rows.map((r) => [r.symbol, r]));
  const rows = symbols.map((s) => bySymbol.get(s)).filter((r): r is InstrumentRow => Boolean(r));
  const avg = rows.reduce((a, r) => a + r.changePct1D, 0) / Math.max(1, rows.length);
  const flagged = rows.filter((r) => r.signal.flagged).length;

  return (
    <div>
      <StaleBanner status={state.status} />
      <div className="mx-4 mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-card)] bg-line lg:mx-0">
        <div className="bg-surface px-4 py-3">
          <p className="text-[0.75rem] text-fg-2">Werte</p>
          <p className="tnum text-[1.125rem] font-semibold">{rows.length}</p>
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="text-[0.75rem] text-fg-2">Ø heute</p>
          <p className={`tnum whitespace-nowrap text-[1.125rem] font-semibold ${avg >= 0 ? "text-up" : "text-down"}`}>
            <span aria-hidden="true" className="mr-1 text-[0.7em]">
              {avg >= 0 ? "▲" : "▼"}
            </span>
            {formatPercent(avg, 2)}
          </p>
        </div>
        <div className="bg-surface px-4 py-3">
          <p className="text-[0.75rem] text-fg-2">Mit Signal</p>
          <p className="tnum text-[1.125rem] font-semibold text-accent">{flagged}</p>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between px-4 lg:px-0">
        <h2 className="text-[1.0625rem] font-semibold">Deine Werte</h2>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="press text-[0.9375rem] font-medium text-accent"
          aria-pressed={editing}
        >
          {editing ? "Fertig" : "Bearbeiten"}
        </button>
      </div>

      <ul className="mx-4 overflow-hidden rounded-[var(--radius-card)] bg-surface lg:mx-0" data-testid="watchlist">
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <m.li
              key={r.symbol}
              layout="position"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.22 } }}
              className="flex items-center border-b border-line last:border-b-0"
            >
              <AnimatePresence initial={false}>
                {editing && (
                  <m.button
                    type="button"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 44, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    onClick={() => remove(r.symbol)}
                    aria-label={`${r.name} entfernen`}
                    className="grid h-full shrink-0 place-items-center overflow-hidden pl-3"
                  >
                    <span className="grid size-6 place-items-center rounded-full bg-down text-[1.1rem] font-bold leading-none text-white">
                      −
                    </span>
                  </m.button>
                )}
              </AnimatePresence>
              <div className="min-w-0 flex-1">
                <InstrumentRowItem
                  row={r}
                  shared
                  spark
                  meta={
                    <span className="inline-flex items-center gap-1.5">
                      {r.ticker}
                      {r.signal.flagged && (
                        <span className="rounded-full bg-accent-soft px-1.5 text-[0.6875rem] font-semibold text-accent">
                          Signal {r.signal.score}
                        </span>
                      )}
                    </span>
                  }
                  trailing={
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="tnum text-[0.9375rem] font-medium">{formatPrice(r.price, r.currency)}</span>
                      <ChangePill value={r.changePct1D} />
                    </div>
                  }
                />
              </div>
            </m.li>
          ))}
        </AnimatePresence>
      </ul>
      <DataStatusLine status={state.status} className="mt-3 px-4 lg:px-0" />
      <p className="mt-2 px-4 text-[0.75rem] text-fg-2 lg:px-0">
        Die Watchlist wird nur lokal in diesem Browser gespeichert – ohne Konto, ohne Server.
      </p>
    </div>
  );
}
