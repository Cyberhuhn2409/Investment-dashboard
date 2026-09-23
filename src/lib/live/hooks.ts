"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  getLiveState,
  getQuote,
  retainLive,
  subscribeLiveState,
  subscribeQuote,
  type LiveQuote,
  type LiveState,
} from "./store";

/** Meldet Symbole für Live-Kurse an, solange die Komponente sichtbar ist. */
export function useLiveSymbols(keys: readonly string[]) {
  const joined = keys.join(",");
  useEffect(() => {
    if (!joined) return;
    return retainLive(joined.split(","));
  }, [joined]);
}

const noQuote = () => undefined;

/** Aktueller Live-Kurs eines Symbols (undefined bis zum ersten Tick). */
export function useLiveQuote(key: string | null | undefined): LiveQuote | undefined {
  const subscribe = useCallback((cb: () => void) => (key ? subscribeQuote(key, cb) : () => {}), [key]);
  const get = useCallback(() => (key ? getQuote(key) : undefined), [key]);
  return useSyncExternalStore(subscribe, get, noQuote);
}

const SERVER_STATE: LiveState = { status: "idle", mode: null, lastTickAt: null };

export function useLiveState(): LiveState {
  return useSyncExternalStore(subscribeLiveState, getLiveState, () => SERVER_STATE);
}
