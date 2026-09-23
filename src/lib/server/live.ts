import "server-only";
import { INDICES, getInstrument, type IndexDef, type Instrument } from "@/config/universe";
import { latestSession } from "@/lib/market-time";
import { generateIndex, generateInstrument, indexSimParams, simParams } from "@/lib/providers/mock/generator";
import { roundPrice, simulatedTick, type SimParams } from "@/lib/providers/mock/live-sim";
import { FinnhubStream } from "@/lib/providers/real/finnhub-stream";
import type { LiveTick } from "@/lib/types";
import { mockScenario, nowMs } from "./clock";
import { getIndexRows, liveQuote } from "./market";
import { getProviders } from "./registry";

/**
 * Live-Kurse für den SSE-Stream `/api/live`.
 *
 * - Demo: deterministische Simulation (gleiche Funktion wie beim Server-Rendering).
 * - Finnhub-Schlüssel: echte Trades über das WebSocket-Relay (US-Aktien, ETF-Proxys).
 * - Sonst: zuletzt geladener Kurs („verzögert“), ohne zusätzliche API-Aufrufe.
 */

export const MAX_LIVE_KEYS = 150;
/** Bis zu so vielen Symbolen lädt der Stream Kurse aktiv nach (Detailseite). */
const FRESH_LIMIT = 5;
const INDEX_BY_ID = new Map<string, IndexDef>(INDICES.map((i) => [i.id, i]));
const BOOT = Date.now();

/** Live-Uhr: echte Zeit; bei eingefrorenem MOCK_NOW läuft sie ab Serverstart weiter. */
export function liveNowMs(): number {
  return process.env.MOCK_NOW ? nowMs() + (Date.now() - BOOT) : Date.now();
}

export function resolveLiveKeys(raw: readonly string[]): string[] {
  const out = new Set<string>();
  for (const r of raw) {
    const k = r.trim();
    if (!k) continue;
    if (INDEX_BY_ID.has(k)) out.add(k);
    else {
      const inst = getInstrument(k);
      if (inst) out.add(inst.symbol);
    }
    if (out.size >= MAX_LIVE_KEYS) break;
  }
  return [...out];
}

/* ------------------------------------------------------------------ */
/* Echtzeit-Relay                                                      */
/* ------------------------------------------------------------------ */

const g = globalThis as { __signalFinnhubStream?: FinnhubStream | null };

function stream(): FinnhubStream | null {
  if (getProviders().demo) return null;
  if (g.__signalFinnhubStream !== undefined) return g.__signalFinnhubStream;
  const key = process.env.FINNHUB_API_KEY?.trim();
  g.__signalFinnhubStream =
    key && process.env.FINNHUB_WS !== "false" && FinnhubStream.available() ? new FinnhubStream(key) : null;
  return g.__signalFinnhubStream;
}

export type LiveMode = "sim" | "realtime" | "delayed";

export function liveMode(): LiveMode {
  if (getProviders().demo) return "sim";
  return stream() ? "realtime" : "delayed";
}

/** Intervall, in dem der Stream neue Kurse prüft (ms). */
export function liveIntervalMs(): number {
  return liveMode() === "delayed" ? 15_000 : 1_000;
}

function streamSymbol(key: string): string | null {
  const def = INDEX_BY_ID.get(key);
  if (def) return def.region === "US" ? def.proxy : null;
  const inst = getInstrument(key);
  if (!inst || inst.region !== "US" || getProviders().price(inst).mock) return null;
  return inst.ticker;
}

/** Meldet Interesse an Symbolen (für das WebSocket-Abo); Rückgabe gibt sie frei. */
export function retainLive(keys: readonly string[]): () => void {
  const s = stream();
  if (!s) return () => {};
  return s.retain(keys.map(streamSymbol).filter((x): x is string => x !== null));
}

/* ------------------------------------------------------------------ */
/* Ticks                                                               */
/* ------------------------------------------------------------------ */

interface SimBase {
  slot: string;
  params: SimParams;
  prev: number;
  close: number;
  open: boolean;
  sessionClose: number;
}

const simCache = new Map<string, SimBase>();

function simBase(key: string, now: number): SimBase | null {
  const def = INDEX_BY_ID.get(key);
  const inst = def ? undefined : getInstrument(key);
  const region = def?.region ?? inst?.region;
  if (!region) return null;
  const session = latestSession(region, now);
  const slot = `${session.day}:${session.isOpen ? Math.floor(now / 300_000) : "closed"}`;
  const hit = simCache.get(key);
  if (hit?.slot === slot) return hit;
  let base: SimBase;
  if (def) {
    const data = generateIndex(def, now);
    const n = data.daily.length;
    base = {
      slot,
      params: indexSimParams(def, data),
      prev: data.daily[n - 2]!.c,
      close: data.daily[n - 1]!.c,
      open: session.isOpen,
      sessionClose: session.close,
    };
  } else {
    const data = generateInstrument(inst!, now);
    const n = data.daily.length;
    base = {
      slot,
      params: simParams(inst!, data),
      prev: data.daily[n - 2]!.c,
      close: data.daily[n - 1]!.c,
      open: session.isOpen,
      sessionClose: session.close,
    };
  }
  if (simCache.size > 1000) simCache.clear();
  simCache.set(key, base);
  return base;
}

function simTick(key: string, now: number): LiveTick | null {
  const b = simBase(key, now);
  if (!b) return null;
  const tick = b.open ? simulatedTick(b.params, now) : { price: roundPrice(b.close), time: b.sessionClose };
  return toTick(key, tick.price, b.prev, tick.time, "sim", b.open);
}

function toTick(key: string, price: number, prev: number, time: number, q: LiveTick["q"], open: boolean): LiveTick {
  const c = price - prev;
  return {
    s: key,
    p: price,
    c: Math.round(c * 10_000) / 10_000,
    cp: prev > 0 ? Math.round((price / prev - 1) * 1e6) / 1e4 : 0,
    t: time,
    q,
    m: open ? 1 : 0,
  };
}

async function realTick(key: string, fresh: boolean, now: number): Promise<LiveTick | null> {
  const s = stream();
  const def = INDEX_BY_ID.get(key);
  if (def) {
    const row = (await getIndexRows()).find((r) => r.id === def.id);
    if (!row) return null;
    const prev = row.value - row.change;
    const trade = def.region === "US" ? s?.latest(def.proxy) : undefined;
    if (trade) return toTick(key, trade.price, prev, trade.time, "rt", row.marketOpen);
    return toTick(key, row.value, prev, now, "delayed", row.marketOpen);
  }
  const inst = getInstrument(key) as Instrument;
  if (getProviders().price(inst).mock) return simTick(key, now);
  const quote = await liveQuote(inst, fresh);
  if (!quote) return null;
  const trade = inst.region === "US" ? s?.latest(inst.ticker) : undefined;
  if (trade && trade.time >= quote.time) {
    return toTick(key, trade.price, quote.prevClose, trade.time, "rt", latestSession(inst.region, now).isOpen);
  }
  return toTick(key, quote.price, quote.prevClose, quote.time, "delayed", quote.marketOpen);
}

export async function liveTicks(keys: readonly string[]): Promise<LiveTick[]> {
  const ps = getProviders();
  if (ps.demo && mockScenario() === "error") throw new Error("Demo-Szenario: Datenquelle nicht erreichbar");
  const now = liveNowMs();
  if (ps.demo) return keys.map((k) => simTick(k, now)).filter((t): t is LiveTick => t !== null);
  const fresh = keys.length <= FRESH_LIMIT;
  const ticks = await Promise.all(keys.map((k) => realTick(k, fresh, now).catch(() => null)));
  return ticks.filter((t): t is LiveTick => t !== null);
}
