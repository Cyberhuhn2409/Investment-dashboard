import type { IndexDef, Instrument } from "@/config/universe";

/** OHLCV-Kerze. `t` = Unix-Sekunden (Beginn des Intervalls, UTC). */
export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Quote {
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  /** Zeitpunkt des Kurses (ms). */
  time: number;
  /** Ob der Heimatmarkt gerade geöffnet ist. */
  marketOpen: boolean;
}

export interface Fundamentals {
  marketCapBn: number | null;
  pe: number | null;
  dividendYieldPct: number | null;
  beta: number | null;
  high52w: number | null;
  low52w: number | null;
  avgVolume: number | null;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string | null;
  source: string;
  url: string;
  /** ms */
  publishedAt: number;
  /** −1…+1, falls bekannt */
  sentiment: number | null;
}

export type DiscussionSource = "reddit" | "stocktwits" | "forum";

export interface Discussion {
  id: string;
  source: DiscussionSource;
  /** z. B. „r/wallstreetbets“ */
  community: string;
  title: string | null;
  snippet: string;
  url: string;
  /** Upvotes / Likes */
  score: number;
  comments: number;
  /** ms */
  createdAt: number;
  /** −1…+1 */
  sentiment: number;
}

/** Tageswerte für Social-Aktivität, chronologisch. `t` = Unix-Sekunden (Tagesbeginn UTC). */
export interface SocialDay {
  t: number;
  mentions: number;
  /** Durchschnittliche Stimmung −1…+1, null = unbekannt. */
  sentiment: number | null;
}

export interface SocialData {
  daily: SocialDay[];
  /** Stündliche Erwähnungen der letzten ~2 Tage (optional, für den 1T-Chart). */
  hourly: { t: number; mentions: number }[];
  /** Anteile nach Quelle, Summe ≈ 1. */
  sources: { name: string; share: number }[];
}

export interface ProviderInfo {
  id: string;
  label: string;
  /** Ob es sich um Demo-Daten handelt. */
  mock: boolean;
  /** Pflicht-Hinweis/Attribution des Anbieters. */
  attribution?: { text: string; url: string };
}

export interface PriceProvider extends ProviderInfo {
  supports(instrument: Instrument): boolean;
  /** Tageskerzen, chronologisch, höchstens `days` Handelstage. */
  getDailyCandles(instrument: Instrument, days: number): Promise<Candle[]>;
  /** 5-Minuten-Kerzen der letzten Handelssitzung. */
  getIntradayCandles(instrument: Instrument): Promise<Candle[]>;
  /** 30-Minuten-Kerzen der letzten 5 Handelssitzungen. */
  getWeekCandles(instrument: Instrument): Promise<Candle[]>;
  getQuote(instrument: Instrument): Promise<Quote>;
  getFundamentals(instrument: Instrument): Promise<Fundamentals>;
}

export interface IndexProvider extends ProviderInfo {
  getIndexDaily(index: IndexDef, days: number): Promise<Candle[]>;
  getIndexIntraday(index: IndexDef): Promise<Candle[]>;
}

export interface NewsResult {
  /** Nachrichten, neueste zuerst (ggf. gekürzt). */
  items: NewsItem[];
  /** Anzahl Nachrichten je UTC-Kalendertag, ältester zuerst, letzter = heute. */
  daily: number[];
}

export interface NewsProvider extends ProviderInfo {
  supports(instrument: Instrument): boolean;
  getNews(instrument: Instrument, days: number): Promise<NewsResult>;
}

export interface SocialProvider extends ProviderInfo {
  supports(instrument: Instrument): boolean;
  /** Tägliche Erwähnungen + Stimmung (≥ 31 Tage wünschenswert). */
  getSocial(instrument: Instrument): Promise<SocialData>;
  /** Relevanteste Diskussionen, sortiert nach Relevanz. */
  getDiscussions(instrument: Instrument, limit: number): Promise<Discussion[]>;
}

export interface AnalyzerSummary {
  text: string;
  sentiments?: number[];
}

export interface TextAnalyzer extends ProviderInfo {
  /** Stimmung je Text, −1…+1. */
  scoreTexts(texts: string[]): Promise<number[]>;
  /**
   * Kurze deutsche Zusammenfassung der Diskussionen. Optional mit neu
   * bewerteter Stimmung je Diskussion (gleiche Reihenfolge), sonst null.
   */
  summarize(instrument: Instrument, discussions: Discussion[]): Promise<AnalyzerSummary | null>;
}
