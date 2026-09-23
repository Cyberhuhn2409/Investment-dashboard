import type { Region } from "@/config/universe";

/**
 * Handelszeiten (vereinfacht, ohne Feiertage): NYSE/Nasdaq 09:30–16:00 New York,
 * XETRA 09:00–17:30 Berlin. Sommer-/Winterzeit wird über Intl korrekt aufgelöst.
 */
const SESSIONS: Record<Region, { tz: string; open: [number, number]; close: [number, number] }> = {
  US: { tz: "America/New_York", open: [9, 30], close: [16, 0] },
  DE: { tz: "Europe/Berlin", open: [9, 0], close: [17, 30] },
};

const DAY_MS = 86_400_000;

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

/** Offset der Zeitzone zu UTC in Minuten zum Zeitpunkt `ms`. */
export function tzOffsetMinutes(ms: number, tz: string): number {
  const parts = partsFormatter(tz).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

/** Lokales Kalenderdatum (y, m, d) in der Zeitzone. */
function localDate(ms: number, tz: string): { y: number; m: number; d: number } {
  const parts = partsFormatter(tz).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** UTC-Zeitpunkt für eine lokale Uhrzeit an einem lokalen Datum. */
function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMinutes(guess, tz);
  const first = guess - offset * 60_000;
  // Zweiter Durchlauf fängt DST-Wechsel ab.
  const offset2 = tzOffsetMinutes(first, tz);
  return guess - offset2 * 60_000;
}

function isWeekday(y: number, m: number, d: number): boolean {
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow !== 0 && dow !== 6;
}

function shiftDate(y: number, m: number, d: number, days: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export interface Session {
  region: Region;
  /** UTC-Mitternacht des lokalen Handelstags in Sekunden – Zeitstempel für Tageskerzen. */
  day: number;
  open: number;
  close: number;
  /** Ob die Sitzung zum Referenzzeitpunkt läuft. */
  isOpen: boolean;
}

function sessionFor(region: Region, y: number, m: number, d: number, nowMs: number): Session {
  const s = SESSIONS[region];
  const open = zonedToUtc(y, m, d, s.open[0], s.open[1], s.tz);
  const close = zonedToUtc(y, m, d, s.close[0], s.close[1], s.tz);
  return { region, day: Date.UTC(y, m - 1, d) / 1000, open, close, isOpen: nowMs >= open && nowMs < close };
}

/** Jüngste begonnene Handelssitzung (heute, falls bereits eröffnet, sonst letzter Werktag). */
export function latestSession(region: Region, nowMs: number): Session {
  const tz = SESSIONS[region].tz;
  let { y, m, d } = localDate(nowMs, tz);
  for (let i = 0; i < 10; i++) {
    if (isWeekday(y, m, d)) {
      const session = sessionFor(region, y, m, d, nowMs);
      if (nowMs >= session.open) return session;
    }
    ({ y, m, d } = shiftDate(y, m, d, -1));
  }
  throw new Error("Keine Handelssitzung gefunden");
}

const calendarCache = new Map<string, Session[]>();

/** Die letzten `count` Handelstage bis einschließlich der jüngsten Sitzung, chronologisch. */
export function tradingDays(region: Region, nowMs: number, count: number): Session[] {
  const latest = latestSession(region, nowMs);
  const key = `${region}:${latest.day}:${latest.isOpen}:${count}`;
  const hit = calendarCache.get(key);
  if (hit) return hit;
  if (calendarCache.size > 50) calendarCache.clear();
  const days = buildTradingDays(region, latest, nowMs, count);
  calendarCache.set(key, days);
  return days;
}

function buildTradingDays(region: Region, latest: Session, nowMs: number, count: number): Session[] {
  const out: Session[] = [latest];
  const tz = SESSIONS[region].tz;
  let { y, m, d } = localDate(latest.open, tz);
  while (out.length < count) {
    ({ y, m, d } = shiftDate(y, m, d, -1));
    if (isWeekday(y, m, d)) out.push(sessionFor(region, y, m, d, nowMs));
  }
  return out.reverse();
}

/** UTC-Tagesbeginn (Sekunden) für einen Zeitpunkt. */
export function utcDayStart(ms: number): number {
  return Math.floor(ms / DAY_MS) * 86_400;
}

export function isMarketOpen(region: Region, nowMs: number): boolean {
  return latestSession(region, nowMs).isOpen;
}
