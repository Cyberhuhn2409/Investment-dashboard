import type { IndexDef, Instrument } from "@/config/universe";
import { latestSession } from "@/lib/market-time";
import type {
  Candle,
  Fundamentals,
  IndexProvider,
  NewsProvider,
  NewsResult,
  PriceProvider,
  Quote,
  SocialData,
  SocialProvider,
  Discussion,
} from "../types";
import { generateIndex, generateInstrument, indexSimParams, simParams, weekCandles } from "./generator";
import { simulatedTick } from "./live-sim";

/** Letzte Kerze auf den simulierten Live-Kurs setzen (nur bei offener Börse). */
function withLiveClose(candles: Candle[], price: number | null): Candle[] {
  const last = candles[candles.length - 1];
  if (!last || price === null) return candles;
  return [...candles.slice(0, -1), { ...last, c: price, h: Math.max(last.h, price), l: Math.min(last.l, price) }];
}

/**
 * Deterministischer Mock-Provider: vollständig offline, ohne Schlüssel.
 * Das Referenz-„Jetzt“ wird injiziert, damit Tests und Screenshots stabil sind.
 */
export function createMockProviders(clock: () => number) {
  const info = { id: "mock", label: "Demo-Daten", mock: true } as const;

  const price: PriceProvider = {
    ...info,
    supports: () => true,
    async getDailyCandles(instrument: Instrument, days: number): Promise<Candle[]> {
      return generateInstrument(instrument, clock()).daily.slice(-days);
    },
    async getIntradayCandles(instrument: Instrument): Promise<Candle[]> {
      const now = clock();
      const data = generateInstrument(instrument, now);
      const open = latestSession(instrument.region, now).isOpen;
      return withLiveClose(data.intraday, open ? simulatedTick(simParams(instrument, data), now).price : null);
    },
    async getWeekCandles(instrument: Instrument): Promise<Candle[]> {
      return weekCandles(instrument, generateInstrument(instrument, clock()));
    },
    async getQuote(instrument: Instrument): Promise<Quote> {
      const now = clock();
      const data = generateInstrument(instrument, now);
      const last = data.daily[data.daily.length - 1]!;
      const prev = data.daily[data.daily.length - 2]!;
      const session = latestSession(instrument.region, now);
      // Offene Börse: simulierter Live-Kurs (derselbe wie im Live-Stream)
      const tick = session.isOpen ? simulatedTick(simParams(instrument, data), now) : null;
      const price = tick?.price ?? last.c;
      return {
        price,
        prevClose: prev.c,
        change: price - prev.c,
        changePct: (price / prev.c - 1) * 100,
        open: last.o,
        high: Math.max(last.h, price),
        low: Math.min(last.l, price),
        volume: last.v,
        time: tick?.time ?? session.close,
        marketOpen: session.isOpen,
      };
    },
    async getFundamentals(instrument: Instrument): Promise<Fundamentals> {
      return generateInstrument(instrument, clock()).fundamentals;
    },
  };

  const index: IndexProvider = {
    ...info,
    async getIndexDaily(def: IndexDef, days: number): Promise<Candle[]> {
      return generateIndex(def, clock()).daily.slice(-days);
    },
    async getIndexIntraday(def: IndexDef): Promise<Candle[]> {
      const now = clock();
      const data = generateIndex(def, now);
      const open = latestSession(def.region, now).isOpen;
      return withLiveClose(data.intraday, open ? simulatedTick(indexSimParams(def, data), now).price : null);
    },
  };

  const news: NewsProvider = {
    ...info,
    supports: () => true,
    async getNews(instrument: Instrument, days: number): Promise<NewsResult> {
      const data = generateInstrument(instrument, clock());
      return { items: data.news, daily: data.newsDaily.slice(-days) };
    },
  };

  const social: SocialProvider = {
    ...info,
    supports: () => true,
    async getSocial(instrument: Instrument): Promise<SocialData> {
      return generateInstrument(instrument, clock()).social;
    },
    async getDiscussions(instrument: Instrument, limit: number): Promise<Discussion[]> {
      return generateInstrument(instrument, clock()).discussions.slice(0, limit);
    },
  };

  return { price, index, news, social };
}
