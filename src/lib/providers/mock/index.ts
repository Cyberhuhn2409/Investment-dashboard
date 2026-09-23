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
import { generateIndex, generateInstrument, weekCandles } from "./generator";

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
      return generateInstrument(instrument, clock()).intraday;
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
      const lastBar = data.intraday[data.intraday.length - 1];
      return {
        price: last.c,
        prevClose: prev.c,
        change: last.c - prev.c,
        changePct: (last.c / prev.c - 1) * 100,
        open: last.o,
        high: last.h,
        low: last.l,
        volume: last.v,
        time: session.isOpen ? Math.min(now, (lastBar?.t ?? 0) * 1000 + 300_000) : session.close,
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
      return generateIndex(def, clock()).intraday;
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
