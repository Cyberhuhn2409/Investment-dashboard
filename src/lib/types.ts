/** Vom Server an die UI gelieferte Datenstrukturen (keine Server-Abhängigkeiten). */
import type { SectorId } from "@/config/sectors";
import type { SignalType } from "@/config/signals";
import type { Currency, Exchange, IndexDef, Region } from "@/config/universe";
import type { Discussion, Fundamentals, NewsItem, Quote } from "@/lib/providers/types";
import type { Confidence, Signal, SignalDirection } from "@/lib/scoring/types";

export type { Discussion, Fundamentals, NewsItem, Quote };

export interface CompactSignal {
  score: number;
  type: SignalType;
  direction: SignalDirection;
  headline: string;
  reason: string;
  /** Bis zu zwei Kurzbegründungen für Karten. */
  highlights: string[];
  confidence: Confidence;
  flagged: boolean;
}

export interface InstrumentRow {
  symbol: string;
  ticker: string;
  name: string;
  sector: SectorId;
  region: Region;
  exchange: Exchange;
  currency: Currency;
  price: number;
  change1D: number;
  changePct1D: number;
  changePct1W: number;
  changePct1M: number;
  capUsdBn: number;
  /** Schlusskurse der letzten ~30 Handelstage. */
  spark: number[];
  mentions24h: number;
  mentionsBaseline: number;
  /** Erwähnungen ggü. 30-Tage-Schnitt in % */
  buzzChangePct: number;
  /** Stimmung heute −1…+1 */
  sentiment: number | null;
  signal: CompactSignal;
  demo: boolean;
}

export interface IndexRow {
  id: IndexDef["id"];
  name: string;
  currency: Currency;
  value: number;
  change: number;
  changePct: number;
  spark: number[];
  marketOpen: boolean;
  demo: boolean;
}

export interface SourceInfo {
  id: string;
  label: string;
  mock: boolean;
  attribution?: { text: string; url: string };
}

export interface DataStatus {
  /** Zeitpunkt der jüngsten Kursdaten (ms). */
  asOf: number;
  /** Zeitpunkt der Erstellung dieser Antwort (ms). */
  generatedAt: number;
  stale: boolean;
  demo: boolean;
  marketOpen: Record<Region, boolean>;
  sources: SourceInfo[];
  coverage: { loaded: number; total: number };
  notes: string[];
}

export interface Snapshot {
  status: DataStatus;
  rows: InstrumentRow[];
  indices: IndexRow[];
}

export const CHART_RANGES = ["1D", "1W", "1M", "6M", "1Y", "5Y"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export const CHART_RANGE_LABEL: Record<ChartRange, string> = {
  "1D": "1T",
  "1W": "1W",
  "1M": "1M",
  "6M": "6M",
  "1Y": "1J",
  "5Y": "5J",
};

export interface ChartPoint {
  /** Unix-Sekunden */
  t: number;
  v: number;
}

export interface ChartData {
  range: ChartRange;
  points: ChartPoint[];
  /** Erwähnungen je Kerze, gleiche Zeitstempel wie `points` (nur wo Daten vorliegen). */
  mentions: ChartPoint[];
  /** Referenzwert für die Veränderung im Zeitraum (Vortagesschluss bei 1T). */
  baseline: number;
  intraday: boolean;
  currency: Currency;
}

export interface SentimentDay {
  t: number;
  sentiment: number | null;
  mentions: number;
}

export interface DiscussionSummary {
  text: string;
  method: "ai" | "lexicon";
}

export interface InstrumentDetail {
  row: InstrumentRow;
  quote: Quote;
  fundamentals: Fundamentals;
  signal: Signal;
  chart: ChartData;
  sentimentDays: SentimentDay[];
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  socialSources: { name: string; share: number }[];
  discussions: Discussion[];
  news: NewsItem[];
  summary: DiscussionSummary | null;
  status: DataStatus;
}
