/**
 * Client-Store für Live-Kurse. Eine einzige EventSource-Verbindung bedient alle
 * Komponenten; Symbole werden per Referenzzählung angemeldet. Die Verbindung
 * startet erst nach dem ersten Rendern (kein Einfluss auf LCP), pausiert bei
 * verborgenem Tab und verbindet sich nach Netzausfall selbst neu.
 */
import type { LiveTick } from "@/lib/types";

export interface LiveQuote extends LiveTick {
  /** Richtung des letzten Ticks ggü. dem vorherigen Kurs */
  dir: 1 | -1 | 0;
  /** Laufende Nummer (für Tick-Animationen) */
  seq: number;
  /** Empfangszeitpunkt (ms, Client-Uhr) */
  at: number;
}

export type LiveStatus = "idle" | "connecting" | "live" | "paused" | "offline" | "unavailable";
export type LiveMode = "sim" | "realtime" | "delayed";

export interface LiveState {
  status: LiveStatus;
  mode: LiveMode | null;
  /** Zeitpunkt des letzten empfangenen Ticks (ms, Client-Uhr) */
  lastTickAt: number | null;
}

const START_DELAY_MS = 1_200;
const quotes = new Map<string, LiveQuote>();
const quoteListeners = new Map<string, Set<() => void>>();
const stateListeners = new Set<() => void>();
const refs = new Map<string, number>();

let state: LiveState = { status: "idle", mode: null, lastTickAt: null };
let source: EventSource | null = null;
let connectedKey = "";
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let started = false;
let firstSync = true;
let seq = 0;

function setState(patch: Partial<LiveState>) {
  const next = { ...state, ...patch };
  if (next.status === state.status && next.mode === state.mode && next.lastTickAt === state.lastTickAt) return;
  state = next;
  stateListeners.forEach((l) => l());
}

/** Ticks übernehmen (auch für Tests und Fallbacks nutzbar). */
export function applyTicks(ticks: readonly LiveTick[]) {
  const now = Date.now();
  for (const t of ticks) {
    if (typeof t?.s !== "string" || !Number.isFinite(t.p)) continue;
    const prev = quotes.get(t.s);
    const dir = prev ? (Math.sign(t.p - prev.p) as 1 | -1 | 0) : 0;
    quotes.set(t.s, { ...t, dir, seq: ++seq, at: now });
    quoteListeners.get(t.s)?.forEach((l) => l());
  }
  if (ticks.length > 0) setState({ lastTickAt: now });
}

function wantedKey(): string {
  return [...refs.keys()].sort().join(",");
}

function disconnect() {
  source?.close();
  source = null;
  connectedKey = "";
}

function connect() {
  if (typeof window === "undefined") return;
  const key = wantedKey();
  if (!key) {
    disconnect();
    setState({ status: "idle" });
    return;
  }
  if (document.visibilityState === "hidden") {
    disconnect();
    setState({ status: "paused" });
    return;
  }
  if (key === connectedKey && source) return;
  if (typeof EventSource === "undefined") {
    setState({ status: "unavailable" });
    return;
  }
  disconnect();
  connectedKey = key;
  setState({ status: "connecting" });
  const es = new EventSource(`/api/live?s=${encodeURIComponent(key)}`);
  es.onopen = () => setState({ status: "live" });
  es.onmessage = (e) => {
    try {
      const ticks = JSON.parse(e.data as string) as LiveTick[];
      if (Array.isArray(ticks)) applyTicks(ticks);
      setState({ status: "live" });
    } catch {
      // defekte Nachricht ignorieren
    }
  };
  es.addEventListener("mode", (e) => {
    try {
      const { mode } = JSON.parse((e as MessageEvent).data as string) as { mode: LiveMode };
      setState({ mode });
    } catch {
      // ignorieren
    }
  });
  es.addEventListener("unavailable", () => setState({ status: "unavailable" }));
  es.onerror = () => {
    // EventSource verbindet sich selbst neu (retry vom Server)
    setState({ status: navigator.onLine === false ? "offline" : "connecting" });
  };
  source = es;
}

function scheduleSync(delay: number) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(connect, delay);
}

function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      disconnect();
      if (refs.size > 0) setState({ status: "paused" });
    } else {
      scheduleSync(0);
    }
  });
  window.addEventListener("online", () => scheduleSync(0));
  window.addEventListener("offline", () => setState({ status: "offline" }));
}

/** Symbole anmelden; die Rückgabe meldet sie wieder ab. */
export function retainLive(keys: readonly string[]): () => void {
  ensureStarted();
  for (const k of keys) refs.set(k, (refs.get(k) ?? 0) + 1);
  scheduleSync(firstSync ? START_DELAY_MS : 150);
  firstSync = false;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const k of keys) {
      const n = (refs.get(k) ?? 0) - 1;
      if (n <= 0) refs.delete(k);
      else refs.set(k, n);
    }
    // Kurz warten: beim Seitenwechsel melden neue Komponenten gleich wieder an
    scheduleSync(400);
  };
}

export function getQuote(key: string): LiveQuote | undefined {
  return quotes.get(key);
}

export function subscribeQuote(key: string, listener: () => void): () => void {
  let set = quoteListeners.get(key);
  if (!set) {
    set = new Set();
    quoteListeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) quoteListeners.delete(key);
  };
}

export function getLiveState(): LiveState {
  return state;
}

export function subscribeLiveState(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}
