"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Lokale Watchlist (nur im Browser, keine Konten). Speichert Symbole in
 * localStorage und synchronisiert Tabs über das `storage`-Event.
 */
const KEY = "signal:watchlist";
const EVENT = "signal:watchlist";
const EMPTY: readonly string[] = Object.freeze([]);

let cache: readonly string[] | null = null;

function read(): readonly string[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? Object.freeze(parsed.filter((s): s is string => typeof s === "string")) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: readonly string[]): void {
  cache = Object.freeze([...next]);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Speicher voll oder gesperrt – Liste bleibt für diese Sitzung erhalten.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      callback();
    }
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

const getServerSnapshot = () => EMPTY;

export function useWatchlist() {
  const symbols = useSyncExternalStore(subscribe, read, getServerSnapshot);
  const has = useCallback((symbol: string) => symbols.includes(symbol), [symbols]);
  const toggle = useCallback((symbol: string) => {
    const current = read();
    write(current.includes(symbol) ? current.filter((s) => s !== symbol) : [symbol, ...current]);
  }, []);
  const remove = useCallback((symbol: string) => write(read().filter((s) => s !== symbol)), []);
  const add = useCallback((symbol: string) => {
    const current = read();
    if (!current.includes(symbol)) write([symbol, ...current]);
  }, []);
  return { symbols, has, toggle, remove, add };
}

/** Ob der Client hydriert ist (Watchlist erst dann verlässlich). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function noopSubscribe(): () => void {
  return () => {};
}
