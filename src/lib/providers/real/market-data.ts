import "server-only";
import type { IndexDef, Instrument } from "@/config/universe";
import { latestSession } from "@/lib/market-time";
import { fetchJson, ProviderError } from "@/lib/server/http";
import { getLimiter, RateLimitError } from "@/lib/server/rate-limit";
import type { Candle, Fundamentals, IndexProvider, NewsProvider, NewsResult, PriceProvider, Quote } from "../types";
import {
  ProviderLimitError,
  dailyCounts,
  isoDate,
  parseAlphaDaily,
  parseAlphaNews,
  parseFinnhubMetrics,
  parseFinnhubNews,
  parseFinnhubQuote,
  parseTwelveQuote,
  parseTwelveSeries,
} from "./parsers";

/** Anbieterfehler „Limit erreicht“ in einheitlichen RateLimitError übersetzen. */
async function guard<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ProviderLimitError) throw new RateLimitError(e.message, 60_000);
    throw e;
  }
}

/* ============================== Finnhub ============================== */
// Kostenlos: 60 Aufrufe/Min., US-Aktien. /quote, /company-news, /stock/metric.
// Kerzen (/stock/candle) und Social Sentiment sind Premium → nicht genutzt.

export function createFinnhub(apiKey: string) {
  const limiter = getLimiter("finnhub", { perMinute: Number(process.env.FINNHUB_RPM ?? 55) });
  // Überschreibbar für Tests mit nachgebildetem Anbieter (scripts/fake-providers.mjs) oder Proxys
  const base = process.env.FINNHUB_BASE_URL ?? "https://finnhub.io/api/v1";
  const get = <T>(path: string, revalidate?: number) =>
    fetchJson<T>(`${base}${path}`, { limiter, headers: { "X-Finnhub-Token": apiKey }, revalidate });
  const supports = (i: Instrument) => i.region === "US";

  return {
    id: "finnhub",
    label: "Finnhub",
    supports,
    async quote(i: Instrument): Promise<Quote> {
      const q = parseFinnhubQuote(await get(`/quote?symbol=${encodeURIComponent(i.ticker)}`));
      const session = latestSession("US", Date.now());
      return {
        price: q.price,
        prevClose: q.prevClose,
        change: q.price - q.prevClose,
        changePct: q.prevClose ? (q.price / q.prevClose - 1) * 100 : 0,
        open: q.open,
        high: q.high,
        low: q.low,
        volume: 0,
        time: q.time || Date.now(),
        marketOpen: session.isOpen,
      };
    },
    async fundamentals(i: Instrument): Promise<Partial<Fundamentals>> {
      const [metrics, profile] = await Promise.all([
        get(`/stock/metric?symbol=${encodeURIComponent(i.ticker)}&metric=all`, 43_200),
        get<{ marketCapitalization?: number }>(`/stock/profile2?symbol=${encodeURIComponent(i.ticker)}`, 43_200).catch(
          () => ({}) as { marketCapitalization?: number },
        ),
      ]);
      const m = parseFinnhubMetrics(metrics);
      const cap = profile.marketCapitalization;
      return { ...m, marketCapBn: typeof cap === "number" && cap > 0 ? cap / 1000 : null };
    },
    async news(i: Instrument, days: number): Promise<NewsResult> {
      const now = Date.now();
      const items = parseFinnhubNews(
        await get(`/company-news?symbol=${encodeURIComponent(i.ticker)}&from=${isoDate(now - days * 86_400_000)}&to=${isoDate(now)}`),
      );
      return { items: items.slice(0, 20), daily: dailyCounts(items.map((n) => n.publishedAt), days, now) };
    },
  };
}

/* ============================ Twelve Data ============================ */
// Kostenlos: 8 Credits/Min., 800/Tag, US-Aktien. XETRA erst ab Bezahltarif
// (TWELVEDATA_XETRA=true schaltet es frei). Namensnennung erforderlich.

export function createTwelveData(apiKey: string) {
  const limiter = getLimiter("twelvedata", {
    perMinute: Number(process.env.TWELVEDATA_RPM ?? 8),
    perDay: Number(process.env.TWELVEDATA_RPD ?? 800),
    maxWaitMs: 12_000,
  });
  const xetra = process.env.TWELVEDATA_XETRA === "true";
  const base = process.env.TWELVEDATA_BASE_URL ?? "https://api.twelvedata.com";
  const sym = (i: Instrument) =>
    i.region === "DE" ? `symbol=${encodeURIComponent(i.ticker)}&exchange=XETR` : `symbol=${encodeURIComponent(i.ticker)}`;
  const get = (path: string, revalidate?: number) =>
    guard(fetchJson<unknown>(`${base}${path}&apikey=${apiKey}&timezone=UTC`, { limiter, revalidate }));

  return {
    id: "twelvedata",
    label: "Twelve Data",
    attribution: { text: "Kursdaten: Twelve Data", url: "https://twelvedata.com/" },
    supports: (i: Instrument) => i.region === "US" || xetra,
    async daily(i: Instrument, days: number): Promise<Candle[]> {
      return parseTwelveSeries(await get(`/time_series?${sym(i)}&interval=1day&outputsize=${Math.min(days, 5000)}`, 21_600), true);
    },
    async intraday(i: Instrument): Promise<Candle[]> {
      const candles = parseTwelveSeries(await get(`/time_series?${sym(i)}&interval=5min&outputsize=110`), false);
      const session = latestSession(i.region, Date.now());
      return candles.filter((c) => c.t * 1000 >= session.open);
    },
    async week(i: Instrument): Promise<Candle[]> {
      return parseTwelveSeries(await get(`/time_series?${sym(i)}&interval=30min&outputsize=90`), false);
    },
    async quote(i: Instrument): Promise<Quote> {
      const q = parseTwelveQuote(await get(`/quote?${sym(i)}`));
      return {
        ...q,
        change: q.price - q.prevClose,
        changePct: q.prevClose ? (q.price / q.prevClose - 1) * 100 : 0,
        time: q.time || Date.now(),
      };
    },
    async indexDaily(proxy: string, days: number): Promise<Candle[]> {
      const [ticker, ex] = proxy.split(".");
      const s = ex === "DE" ? `symbol=${ticker}&exchange=XETR` : `symbol=${ticker}`;
      return parseTwelveSeries(await get(`/time_series?${s}&interval=1day&outputsize=${days}`, 21_600), true);
    },
    async indexIntraday(proxy: string): Promise<Candle[]> {
      const [ticker, ex] = proxy.split(".");
      const s = ex === "DE" ? `symbol=${ticker}&exchange=XETR` : `symbol=${ticker}`;
      return parseTwelveSeries(await get(`/time_series?${s}&interval=5min&outputsize=110`), false);
    },
  };
}

/* =========================== Alpha Vantage =========================== */
// Kostenlos: 25 Anfragen/Tag, 5/Min. Einziger kostenloser Weg zu XETRA-
// Tageskursen (Suffix .DEX, 100 Tage „compact“). News mit Sentiment (US).

export function createAlphaVantage(apiKey: string) {
  const limiter = getLimiter("alphavantage", {
    perMinute: Number(process.env.ALPHAVANTAGE_RPM ?? 5),
    perDay: Number(process.env.ALPHAVANTAGE_RPD ?? 25),
    maxWaitMs: 15_000,
  });
  const base = "https://www.alphavantage.co/query";
  const get = (params: string, revalidate?: number) =>
    guard(fetchJson<unknown>(`${base}?${params}&apikey=${apiKey}`, { limiter, revalidate }));
  const avSymbol = (i: Instrument) => (i.region === "DE" ? `${i.ticker}.DEX` : i.ticker);

  return {
    id: "alphavantage",
    label: "Alpha Vantage",
    supports: () => true,
    async daily(i: Instrument): Promise<Candle[]> {
      return parseAlphaDaily(await get(`function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(avSymbol(i))}&outputsize=compact`, 86_400));
    },
    async news(i: Instrument, days: number): Promise<NewsResult> {
      const now = Date.now();
      const from = new Date(now - days * 86_400_000).toISOString().replace(/[-:]/g, "").slice(0, 13);
      const items = parseAlphaNews(
        await get(`function=NEWS_SENTIMENT&tickers=${encodeURIComponent(i.ticker)}&time_from=${from}&limit=200`, 3_600),
      );
      return { items: items.slice(0, 20), daily: dailyCounts(items.map((n) => n.publishedAt), days, now) };
    },
  };
}

/* ======================= Zusammengesetzte Provider ======================= */

type Finnhub = ReturnType<typeof createFinnhub>;
type TwelveData = ReturnType<typeof createTwelveData>;
type AlphaVantage = ReturnType<typeof createAlphaVantage>;

function quoteFromDaily(daily: Candle[], i: Instrument): Quote {
  const last = daily[daily.length - 1];
  const prev = daily[daily.length - 2] ?? last;
  if (!last || !prev) throw new ProviderError("Keine Kursdaten");
  return {
    price: last.c,
    prevClose: prev.c,
    change: last.c - prev.c,
    changePct: (last.c / prev.c - 1) * 100,
    open: last.o,
    high: last.h,
    low: last.l,
    volume: last.v,
    time: latestSession(i.region, Date.now()).close,
    marketOpen: false,
  };
}

function fundamentalsFromDaily(daily: Candle[], i: Instrument): Fundamentals {
  const year = daily.slice(-252);
  const vol = daily.slice(-60);
  return {
    marketCapBn: i.marketCapBn,
    pe: null,
    dividendYieldPct: null,
    beta: null,
    high52w: year.length ? Math.max(...year.map((c) => c.h)) : null,
    low52w: year.length ? Math.min(...year.map((c) => c.l)) : null,
    avgVolume: vol.length ? vol.reduce((a, c) => a + c.v, 0) / vol.length : null,
  };
}

/**
 * Kombiniert die Anbieter je Region: Twelve Data für Historie/Intraday,
 * Finnhub für Echtzeit-Kurs und Kennzahlen (US), Alpha Vantage für XETRA-
 * Tageskurse. Fehlt eine Quelle, wird – ehrlich – weniger angezeigt statt
 * erfunden.
 */
export function createCompositePrice(sources: { finnhub?: Finnhub; twelve?: TwelveData; alpha?: AlphaVantage }): PriceProvider | null {
  const { finnhub, twelve, alpha } = sources;
  if (!finnhub && !twelve && !alpha) return null;
  const dailySource = (i: Instrument) =>
    twelve?.supports(i) ? (d: number) => twelve.daily(i, d) : alpha ? () => alpha.daily(i) : null;

  const labels = [twelve?.label, finnhub?.label, alpha?.label].filter(Boolean).join(" + ");
  return {
    id: "live-price",
    label: labels,
    mock: false,
    attribution: twelve?.attribution,
    supports: (i) => Boolean(dailySource(i)) || Boolean(finnhub?.supports(i)),
    async getDailyCandles(i, days) {
      const src = dailySource(i);
      return src ? src(days) : [];
    },
    async getIntradayCandles(i) {
      return twelve?.supports(i) ? twelve.intraday(i) : [];
    },
    async getWeekCandles(i) {
      if (twelve?.supports(i)) return twelve.week(i);
      const src = dailySource(i);
      return src ? (await src(10)).slice(-5) : [];
    },
    async getQuote(i) {
      if (finnhub?.supports(i)) return finnhub.quote(i);
      if (twelve?.supports(i)) return twelve.quote(i);
      const src = dailySource(i);
      if (!src) throw new ProviderError(`Kein Kursanbieter für ${i.symbol}`);
      return quoteFromDaily(await src(5), i);
    },
    async getFundamentals(i) {
      const src = dailySource(i);
      const daily = src ? await src(260).catch(() => [] as Candle[]) : [];
      const base = fundamentalsFromDaily(daily, i);
      if (!finnhub?.supports(i)) return base;
      const f = await finnhub.fundamentals(i).catch(() => ({}) as Partial<Fundamentals>);
      return {
        marketCapBn: f.marketCapBn ?? base.marketCapBn,
        pe: f.pe ?? null,
        dividendYieldPct: f.dividendYieldPct ?? null,
        beta: f.beta ?? null,
        high52w: f.high52w ?? base.high52w,
        low52w: f.low52w ?? base.low52w,
        avgVolume: f.avgVolume ?? base.avgVolume,
      };
    },
  };
}

/** Indizes über handelbare ETF-Proxys (SPY, QQQ, EXS1) – Anbieter liefern Indexstände meist nur im Bezahltarif. */
export function createProxyIndexProvider(twelve?: TwelveData): IndexProvider | null {
  if (!twelve) return null;
  return {
    id: "twelvedata-etf",
    label: "Twelve Data (ETF-Proxys)",
    mock: false,
    attribution: twelve.attribution,
    async getIndexDaily(def: IndexDef, days: number) {
      return twelve.indexDaily(def.proxy, days);
    },
    async getIndexIntraday(def: IndexDef) {
      return twelve.indexIntraday(def.proxy);
    },
  };
}

export function createNewsProvider(sources: { finnhub?: Finnhub; alpha?: AlphaVantage }): NewsProvider | null {
  const { finnhub, alpha } = sources;
  if (!finnhub && !alpha) return null;
  return {
    id: finnhub ? "finnhub-news" : "alphavantage-news",
    label: finnhub ? "Finnhub News" : "Alpha Vantage News",
    mock: false,
    // Beide Anbieter liefern Unternehmensnachrichten nur für US-Werte zuverlässig.
    supports: (i) => i.region === "US",
    async getNews(i, days) {
      if (finnhub) return finnhub.news(i, days);
      return alpha!.news(i, days);
    },
  };
}
