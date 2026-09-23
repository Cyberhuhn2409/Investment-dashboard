"use client";

import { formatNumber, formatPrice } from "@/lib/format";
import { useLiveQuote, useLiveSymbols } from "@/lib/live/hooks";
import { ChangePill, ChangeText } from "../ui/change";

export interface LiveValues {
  price: number;
  change: number;
  changePct: number;
  /** Richtung des letzten Ticks */
  dir: 1 | -1 | 0;
  /** Tick-Zähler (0 = noch kein Live-Kurs) */
  seq: number;
  live: boolean;
  /** Börse laut Live-Quelle geöffnet (undefined = unbekannt) */
  open?: boolean;
  /** Zeitpunkt des Live-Kurses (ms) */
  time?: number;
}

/**
 * Live-Werte eines Symbols mit Server-Werten als Ausgangspunkt. Meldet das
 * Symbol automatisch beim Live-Stream an.
 */
export function useLiveValues(symbol: string, fallback: { price: number; changePct: number; change?: number }): LiveValues {
  useLiveSymbols([symbol]);
  const q = useLiveQuote(symbol);
  if (!q) {
    return { price: fallback.price, change: fallback.change ?? NaN, changePct: fallback.changePct, dir: 0, seq: 0, live: false };
  }
  return { price: q.p, change: q.c, changePct: q.cp, dir: q.dir, seq: q.seq, live: true, open: q.m === 1, time: q.t };
}

export function flashClass(v: Pick<LiveValues, "dir" | "seq">): string {
  if (!v.seq || !v.dir) return "";
  return v.dir > 0 ? "tick-up" : "tick-down";
}

/** Kurs mit kurzem Aufleuchten bei jedem Tick. */
export function LivePrice({
  symbol,
  price,
  currency,
  className = "",
  plain = false,
}: {
  symbol: string;
  price: number;
  currency?: "USD" | "EUR";
  className?: string;
  /** Ohne Währungszeichen (z. B. Indizes) */
  plain?: boolean;
}) {
  const v = useLiveValues(symbol, { price, changePct: 0 });
  const text = plain || !currency ? formatNumber(v.price, 2) : formatPrice(v.price, currency);
  return (
    <span key={v.seq} className={`tnum -mx-0.5 px-0.5 ${flashClass(v)} ${className}`}>
      {text}
    </span>
  );
}

/** Veränderung seit Vortagesschluss (live). */
export function LiveChange({
  symbol,
  price,
  changePct,
  pill = false,
  arrow = true,
  digits = 2,
  className = "",
}: {
  symbol: string;
  price: number;
  changePct: number;
  pill?: boolean;
  arrow?: boolean;
  digits?: number;
  className?: string;
}) {
  const v = useLiveValues(symbol, { price, changePct });
  if (pill) return <ChangePill value={v.changePct} digits={digits} className={className} />;
  return <ChangeText value={v.changePct} digits={digits} arrow={arrow} className={className} />;
}
