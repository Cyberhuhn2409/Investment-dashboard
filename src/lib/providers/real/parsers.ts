/**
 * Reine Parser für Anbieter-Antworten. Getrennt von den HTTP-Aufrufen, damit
 * sie ohne Netzwerk mit Fixtures getestet werden können.
 */
import type { Candle, Discussion, NewsItem } from "../types";

const DAY_S = 86_400;

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : NaN;
}

export class ProviderLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderLimitError";
  }
}

/* ------------------------------ Finnhub ------------------------------ */

export interface FinnhubQuote {
  c: number;
  d: number | null;
  dp: number | null;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export function parseFinnhubQuote(json: unknown): { price: number; prevClose: number; open: number; high: number; low: number; time: number } {
  const q = json as Partial<FinnhubQuote>;
  const price = num(q.c);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Finnhub: kein Kurs");
  return {
    price,
    prevClose: num(q.pc),
    open: num(q.o),
    high: num(q.h),
    low: num(q.l),
    time: num(q.t) * 1000,
  };
}

export function parseFinnhubMetrics(json: unknown): {
  high52w: number | null;
  low52w: number | null;
  pe: number | null;
  beta: number | null;
  dividendYieldPct: number | null;
  avgVolume: number | null;
} {
  const m = ((json as { metric?: Record<string, unknown> }).metric ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = num(m[k]);
      if (Number.isFinite(v)) return v;
    }
    return null;
  };
  const avgVolMillions = pick("10DayAverageTradingVolume", "3MonthAverageTradingVolume");
  return {
    high52w: pick("52WeekHigh"),
    low52w: pick("52WeekLow"),
    pe: pick("peTTM", "peBasicExclExtraTTM", "peExclExtraTTM"),
    beta: pick("beta"),
    dividendYieldPct: pick("currentDividendYieldTTM", "dividendYieldIndicatedAnnual"),
    avgVolume: avgVolMillions === null ? null : avgVolMillions * 1e6,
  };
}

interface FinnhubNews {
  id?: number;
  datetime?: number;
  headline?: string;
  source?: string;
  summary?: string;
  url?: string;
}

export function parseFinnhubNews(json: unknown): NewsItem[] {
  if (!Array.isArray(json)) return [];
  return (json as FinnhubNews[])
    .filter((n) => n.headline && n.url && n.datetime)
    .map((n) => ({
      id: `fh-${n.id ?? n.url}`,
      headline: n.headline!.trim(),
      summary: n.summary?.trim() || null,
      source: n.source || "Finnhub",
      url: n.url!,
      publishedAt: n.datetime! * 1000,
      sentiment: null,
    }))
    .sort((a, b) => b.publishedAt - a.publishedAt);
}

/* ---------------------------- Twelve Data ---------------------------- */

interface TwelveValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

function assertTwelveOk(json: unknown): void {
  const j = json as { status?: string; code?: number; message?: string };
  if (j?.status === "error") {
    if (j.code === 429) throw new ProviderLimitError(`Twelve Data: ${j.message ?? "Rate-Limit"}`);
    throw new Error(`Twelve Data: ${j.message ?? "Fehler"}`);
  }
}

/** Twelve-Data-Zeitstempel (mit `timezone=UTC` angefragt) → Unix-Sekunden. */
export function twelveTime(datetime: string, daily: boolean): number {
  const [d, t = "00:00:00"] = datetime.split(" ");
  const [y, m, day] = (d ?? "").split("-").map(Number);
  if (daily) return Date.UTC(y!, m! - 1, day!) / 1000;
  const [hh, mm, ss] = t.split(":").map(Number);
  return Date.UTC(y!, m! - 1, day!, hh ?? 0, mm ?? 0, ss ?? 0) / 1000;
}

export function parseTwelveSeries(json: unknown, daily: boolean): Candle[] {
  assertTwelveOk(json);
  const values = (json as { values?: TwelveValue[] }).values ?? [];
  return values
    .map((v) => ({
      t: twelveTime(v.datetime, daily),
      o: num(v.open),
      h: num(v.high),
      l: num(v.low),
      c: num(v.close),
      v: Number.isFinite(num(v.volume)) ? num(v.volume) : 0,
    }))
    .filter((c) => Number.isFinite(c.c))
    .sort((a, b) => a.t - b.t);
}

export function parseTwelveQuote(json: unknown): {
  price: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  time: number;
  marketOpen: boolean;
} {
  assertTwelveOk(json);
  const q = json as Record<string, unknown>;
  const price = num(q.close);
  if (!Number.isFinite(price)) throw new Error("Twelve Data: kein Kurs");
  return {
    price,
    prevClose: num(q.previous_close),
    open: num(q.open),
    high: num(q.high),
    low: num(q.low),
    volume: num(q.volume) || 0,
    time: (num(q.last_quote_at) || num(q.timestamp)) * 1000,
    marketOpen: q.is_market_open === true,
  };
}

/* --------------------------- Alpha Vantage --------------------------- */

function assertAlphaOk(json: unknown): void {
  const j = json as Record<string, unknown>;
  const info = j.Information ?? j.Note;
  if (typeof info === "string") throw new ProviderLimitError(`Alpha Vantage: ${info.slice(0, 120)}`);
  if (typeof j["Error Message"] === "string") throw new Error(`Alpha Vantage: ${String(j["Error Message"]).slice(0, 120)}`);
}

export function parseAlphaDaily(json: unknown): Candle[] {
  assertAlphaOk(json);
  const series = (json as Record<string, Record<string, Record<string, string>>>)["Time Series (Daily)"] ?? {};
  return Object.entries(series)
    .map(([date, v]) => ({
      t: twelveTime(date, true),
      o: num(v["1. open"]),
      h: num(v["2. high"]),
      l: num(v["3. low"]),
      c: num(v["4. close"]),
      v: num(v["5. volume"]) || 0,
    }))
    .filter((c) => Number.isFinite(c.c))
    .sort((a, b) => a.t - b.t);
}

/** „20260923T143000“ → ms */
export function alphaTime(s: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/.exec(s);
  if (!m) return NaN;
  return Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +(m[6] ?? 0));
}

export function parseAlphaNews(json: unknown): NewsItem[] {
  assertAlphaOk(json);
  const feed = (json as { feed?: Record<string, unknown>[] }).feed ?? [];
  return feed
    .map((f, i) => ({
      id: `av-${i}-${String(f.url ?? "").slice(-40)}`,
      headline: String(f.title ?? "").trim(),
      summary: typeof f.summary === "string" && f.summary ? f.summary : null,
      source: String(f.source ?? "Alpha Vantage"),
      url: String(f.url ?? ""),
      publishedAt: alphaTime(String(f.time_published ?? "")),
      sentiment: Number.isFinite(num(f.overall_sentiment_score)) ? Math.max(-1, Math.min(1, num(f.overall_sentiment_score))) : null,
    }))
    .filter((n) => n.headline && n.url && Number.isFinite(n.publishedAt))
    .sort((a, b) => b.publishedAt - a.publishedAt);
}

/* ----------------------------- ApeWisdom ----------------------------- */

export interface ApeWisdomRow {
  ticker: string;
  mentions: number;
  mentions24hAgo: number;
  upvotes: number;
  rank: number;
}

export function parseApeWisdom(json: unknown): { rows: ApeWisdomRow[]; pages: number } {
  const j = json as { results?: Record<string, unknown>[]; pages?: unknown };
  const rows = (j.results ?? [])
    .map((r) => ({
      ticker: String(r.ticker ?? "").toUpperCase(),
      mentions: num(r.mentions),
      mentions24hAgo: num(r.mentions_24h_ago),
      upvotes: num(r.upvotes) || 0,
      rank: num(r.rank),
    }))
    .filter((r) => r.ticker && Number.isFinite(r.mentions));
  return { rows, pages: Number.isFinite(num(j.pages)) ? num(j.pages) : 1 };
}

/* ------------------------------- Reddit ------------------------------ */

export interface RedditPost {
  id: string;
  title: string;
  text: string;
  subreddit: string;
  score: number;
  comments: number;
  createdAt: number;
  url: string;
}

export function parseRedditListing(json: unknown): RedditPost[] {
  const children = (json as { data?: { children?: { data?: Record<string, unknown> }[] } }).data?.children ?? [];
  return children
    .map((c) => c.data ?? {})
    .map((d) => ({
      id: String(d.id ?? ""),
      title: String(d.title ?? ""),
      text: String(d.selftext ?? ""),
      subreddit: String(d.subreddit ?? ""),
      score: num(d.score) || 0,
      comments: num(d.num_comments) || 0,
      createdAt: num(d.created_utc) * 1000,
      url: `https://www.reddit.com${String(d.permalink ?? "")}`,
    }))
    .filter((p) => p.id && Number.isFinite(p.createdAt));
}

export function redditToDiscussion(p: RedditPost, sentiment: number): Discussion {
  const body = p.text.replace(/\s+/g, " ").trim();
  return {
    id: `rd-${p.id}`,
    source: "reddit",
    community: `r/${p.subreddit}`,
    title: p.title || null,
    snippet: body ? (body.length > 280 ? `${body.slice(0, 277)}…` : body) : p.title,
    url: p.url,
    score: p.score,
    comments: p.comments,
    createdAt: p.createdAt,
    sentiment,
  };
}

/* ---------------------------- Hilfsfunktionen ------------------------ */

/** Anzahl Ereignisse je UTC-Tag für die letzten `days` Tage (ältester zuerst, letzter = heute). */
export function dailyCounts(timestampsMs: readonly number[], days: number, nowMs: number): number[] {
  const today = Math.floor(nowMs / 1000 / DAY_S);
  const counts = new Array<number>(days).fill(0);
  for (const ts of timestampsMs) {
    const d = Math.floor(ts / 1000 / DAY_S);
    const idx = days - 1 - (today - d);
    if (idx >= 0 && idx < days) counts[idx]! += 1;
  }
  return counts;
}

export function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/* ============================ Finnhub WebSocket ============================ */

export interface StreamTrade {
  symbol: string;
  price: number;
  /** ms */
  time: number;
  volume: number;
}

/**
 * Nachricht des Finnhub-Trade-Streams (`{"type":"trade","data":[{s,p,t,v}]}`).
 * Liefert je Symbol nur den jüngsten Trade; Pings und Fehler ergeben [].
 */
export function parseFinnhubTrades(raw: string): StreamTrade[] {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!msg || typeof msg !== "object" || (msg as { type?: unknown }).type !== "trade") return [];
  const data = (msg as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const latest = new Map<string, StreamTrade>();
  for (const d of data) {
    if (!d || typeof d !== "object") continue;
    const { s, p, t, v } = d as Record<string, unknown>;
    if (typeof s !== "string" || typeof p !== "number" || typeof t !== "number" || !(p > 0)) continue;
    const prev = latest.get(s);
    if (!prev || t >= prev.time) latest.set(s, { symbol: s, price: p, time: t, volume: typeof v === "number" ? v : 0 });
  }
  return [...latest.values()];
}
