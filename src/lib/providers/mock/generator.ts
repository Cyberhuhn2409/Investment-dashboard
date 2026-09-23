/**
 * Deterministischer Generator für Demo-Marktdaten.
 *
 * Alle Werte hängen nur vom Symbol und vom Handelskalender ab – dieselbe
 * Eingabe liefert immer dieselben Zahlen. Kurse folgen einer geometrischen
 * Brownschen Bewegung mit Markt- und Sektorfaktor, damit die Heatmap
 * realistische Korrelationen zeigt. Ein Teil der Werte bekommt eine „Story“
 * (z. B. Buzz-Ausbruch), damit Signale entstehen.
 */
import { EUR_USD, type IndexDef, type Instrument, type Region, type SizeClass } from "@/config/universe";
import type { SectorId } from "@/config/sectors";
import { lexiconSentiment } from "@/lib/sentiment/lexicon";
import { tradingDays, type Session } from "@/lib/market-time";
import { createRng, type Rng } from "@/lib/random";
import type { Candle, Discussion, Fundamentals, NewsItem, SocialData, SocialDay } from "../types";
import { DISCUSSIONS_DE, DISCUSSIONS_EN, NEWS_HEADLINES, NEWS_SOURCES, fill, type Tone } from "./templates";
import type { SimParams } from "./live-sim";

export const HISTORY_DAYS = 5 * 252 + 10;
const DAY_S = 86_400;

export type Story =
  | "calm"
  | "buzz-bull"
  | "buzz-bear"
  | "momentum-up"
  | "momentum-down"
  | "sentiment-flip"
  | "news"
  | "volume";

const SECTOR_VOL: Record<SectorId, number> = {
  tech: 0.32,
  communication: 0.3,
  "consumer-discretionary": 0.33,
  "consumer-staples": 0.16,
  health: 0.24,
  financials: 0.24,
  industrials: 0.24,
  energy: 0.28,
  materials: 0.26,
  utilities: 0.18,
  "real-estate": 0.22,
};

const SECTOR_PE: Record<SectorId, number> = {
  tech: 32,
  communication: 22,
  "consumer-discretionary": 26,
  "consumer-staples": 22,
  health: 20,
  financials: 14,
  industrials: 22,
  energy: 12,
  materials: 18,
  utilities: 18,
  "real-estate": 30,
};

const SECTOR_DIV: Record<SectorId, number> = {
  tech: 0.7,
  communication: 1.2,
  "consumer-discretionary": 0.9,
  "consumer-staples": 2.8,
  health: 1.8,
  financials: 2.3,
  industrials: 1.7,
  energy: 3.6,
  materials: 2.2,
  utilities: 3.3,
  "real-estate": 3.9,
};

/** Social-Affinität: wie stark ein Wert in Retail-Foren diskutiert wird (1 = Standard). */
const SOCIAL: Record<string, number> = {
  TSLA: 9, NVDA: 8, GME: 7, PLTR: 7, AMD: 5, AAPL: 4, AMZN: 3.5, META: 3.5, MSFT: 3, GOOGL: 3, COIN: 5, HOOD: 5,
  SOFI: 5, RIVN: 4, SMCI: 5, MU: 3, INTC: 4, NFLX: 2.5, RDDT: 4, BA: 2.5, DIS: 2, F: 2.5, AVGO: 2.5, LLY: 2,
  UNH: 2.5, MRNA: 2.5, SNAP: 2.5, "BRK.B": 2, JPM: 1.5, CRWD: 2, ORCL: 2.5, ARM: 2,
  MSTR: 6, AMC: 5, IONQ: 4, RGTI: 4, QBTS: 3.5, SOUN: 4, BBAI: 3, QUBT: 3, OKLO: 3.5, SMR: 3, ASTS: 4, RKLB: 4,
  HIMS: 3.5, UPST: 2.5, AFRM: 2.5, MARA: 3, RIOT: 2.5, LCID: 3.5, PLUG: 3, OPEN: 4, ACHR: 3, JOBY: 2.5, LUNR: 3,
  CVNA: 2, APP: 3, UBER: 2.5, DKNG: 2, CELH: 2, NVAX: 2, BYND: 2.5, PTON: 2, CLSK: 2, CAVA: 1.8, NNE: 2.5,
  "RHM.DE": 9, "SAP.DE": 5, "VOW3.DE": 5, "DBK.DE": 4, "CBK.DE": 4, "ENR.DE": 5, "IFX.DE": 4, "BAYN.DE": 5,
  "ZAL.DE": 3, "MBG.DE": 3, "BMW.DE": 3, "ALV.DE": 2.5, "DTE.DE": 2.5, "AIR.DE": 3, "HEN3.DE": 1.5, "SIE.DE": 3,
  "HAG.DE": 4, "R3NK.DE": 5, "TKA.DE": 4, "LHA.DE": 2.5, "DHER.DE": 3, "PUM.DE": 2.5, "AIXA.DE": 3, "NDX1.DE": 2.5,
  "HFG.DE": 3, "EVT.DE": 2.5, "TUI1.DE": 2.5, "SMHN.DE": 2.5, "S92.DE": 2.5, "P911.DE": 3, "FTK.DE": 2,
};

/** Volatilitäts-Multiplikator für spekulative Werte. */
const VOL_MULT: Record<string, number> = {
  GME: 2.6, RIVN: 2, SMCI: 2.3, PLTR: 1.8, COIN: 2, HOOD: 1.9, SOFI: 1.8, TSLA: 1.7, MRNA: 1.8, AMD: 1.4,
  NVDA: 1.4, MU: 1.4, RDDT: 2, SNAP: 1.8, INTC: 1.4, CRWD: 1.4, "RHM.DE": 1.6, "ENR.DE": 1.6, "ZAL.DE": 1.5,
  "BAYN.DE": 1.4, "CBK.DE": 1.3, "DBK.DE": 1.3,
  MSTR: 2.2, APP: 1.9, IONQ: 1.9, RGTI: 2.1, QBTS: 2.1, SOUN: 1.9, BBAI: 1.7, QUBT: 1.9, OKLO: 2.2, SMR: 1.9,
  ASTS: 2.2, RKLB: 2, HIMS: 2, UPST: 1.8, AFRM: 1.8, MARA: 1.8, RIOT: 1.8, CLSK: 1.8, AMC: 1.8, LCID: 1.4,
  PLUG: 1.7, OPEN: 1.8, ACHR: 1.6, JOBY: 1.8, LUNR: 1.8, CVNA: 1.8, NNE: 1.8, "HAG.DE": 1.6, "R3NK.DE": 1.7,
  "AIXA.DE": 1.4, "SMHN.DE": 1.4, "TKA.DE": 1.4,
};

/** Volatilität nach Größenklasse: kleinere Werte schwanken stärker. */
const SIZE_VOL: Record<SizeClass, number> = { mega: 0.9, large: 1, mid: 1.3, small: 1.65 };

/** Grobe Kursniveaus bekannter Werte (Demo), sonst aus dem Hash abgeleitet. */
const PRICE: Record<string, number> = {
  AAPL: 232, MSFT: 505, NVDA: 178, AMZN: 228, GOOGL: 245, META: 760, TSLA: 425, AVGO: 345, "BRK.B": 495,
  JPM: 305, V: 345, MA: 590, LLY: 760, UNH: 340, XOM: 114, WMT: 103, COST: 945, NFLX: 1210, AMD: 160,
  PLTR: 180, GME: 26, COIN: 330, HOOD: 125, INTC: 29, ORCL: 290, KO: 68, PEP: 145, DIS: 115, BA: 215,
  "SAP.DE": 232, "SIE.DE": 238, "ALV.DE": 355, "DTE.DE": 29, "AIR.DE": 205, "RHM.DE": 1920, "MBG.DE": 55,
  "BMW.DE": 85, "VOW3.DE": 95, "DBK.DE": 30, "IFX.DE": 33, "BAS.DE": 43, "BAYN.DE": 27, "ENR.DE": 100,
  "MUV2.DE": 540, "ADS.DE": 180, "DHL.DE": 38, "CBK.DE": 32,
};

/** Kuratierte Storys, damit die Demo aussagekräftige Beispiele enthält. */
const FORCED_STORY: Record<string, Story> = {
  NVDA: "buzz-bull",
  "RHM.DE": "momentum-up",
  INTC: "buzz-bull",
  "BAYN.DE": "buzz-bear",
  TSLA: "sentiment-flip",
  UNH: "momentum-down",
  PLTR: "volume",
  "SAP.DE": "news",
  AAPL: "calm",
  MSFT: "calm",
  SMCI: "buzz-bear",
  "ENR.DE": "buzz-bull",
  COIN: "momentum-up",
  NKE: "news",
  RGTI: "buzz-bull",
  "HAG.DE": "momentum-up",
  OKLO: "volume",
  AMC: "buzz-bear",
  "AIXA.DE": "news",
  HIMS: "sentiment-flip",
  "TKA.DE": "buzz-bull",
  PLUG: "momentum-down",
  "SMHN.DE": "volume",
  CELH: "news",
};

export function socialAffinity(symbol: string): number {
  return SOCIAL[symbol] ?? 1;
}

export function storyFor(instrument: Instrument): Story {
  const forced = FORCED_STORY[instrument.symbol];
  if (forced) return forced;
  const rng = createRng(`story:${instrument.symbol}`);
  const social = Math.min(socialAffinity(instrument.symbol), 5);
  const buzzBoost = (social - 1) * 0.03;
  // Im breiten Universum passiert bei den meisten Werten wenig – nur so bleibt
  // „relevant“ eine echte Auswahl.
  const table: [Story, number][] = [
    ["calm", 0.8 - buzzBoost],
    ["buzz-bull", 0.08 + buzzBoost],
    ["buzz-bear", 0.04 + buzzBoost / 2],
    ["momentum-up", 0.08],
    ["momentum-down", 0.06],
    ["sentiment-flip", 0.07],
    ["news", 0.06],
    ["volume", 0.05],
  ];
  const total = table.reduce((a, [, p]) => a + p, 0);
  let x = rng.next() * total;
  for (const [story, p] of table) {
    x -= p;
    if (x <= 0) return story;
  }
  return "calm";
}

/* ------------------------------------------------------------------ */
/* Faktoren                                                            */
/* ------------------------------------------------------------------ */

const factorCache = new Map<string, number[]>();

/** Tägliche Faktorrenditen, indiziert ab dem ältesten Handelstag (gemeinsamer Kalender). */
function factorSeries(key: string, days: number, dailyVol: number, drift: number): number[] {
  const cacheKey = `${key}:${days}`;
  const cached = factorCache.get(cacheKey);
  if (cached) return cached;
  const rng = createRng(`factor:${key}`);
  const out: number[] = [];
  let regime = 0;
  for (let i = 0; i < days; i++) {
    regime = 0.97 * regime + rng.normal(0, 0.12);
    const vol = dailyVol * Math.exp(0.35 * Math.tanh(regime));
    out.push(drift + rng.normal(0, vol));
  }
  factorCache.set(cacheKey, out);
  return out;
}

function marketFactor(region: Region, days: number): number[] {
  return factorSeries(`market:${region}`, days, 0.009, 0.0003);
}

function sectorFactor(sector: SectorId, days: number): number[] {
  return factorSeries(`sector:${sector}`, days, 0.006, 0);
}

/* ------------------------------------------------------------------ */
/* Instrument-Serie                                                    */
/* ------------------------------------------------------------------ */

export interface MockInstrumentData {
  story: Story;
  daily: Candle[];
  intraday: Candle[];
  social: SocialData;
  /** Nachrichten je Kalendertag, gleich ausgerichtet wie social.daily. */
  newsDaily: number[];
  news: NewsItem[];
  discussions: Discussion[];
  fundamentals: Fundamentals;
  sessions: Session[];
}

interface StoryShape {
  /** Zusätzliche Tagesdrift in den letzten `days` Handelstagen. */
  drift: number;
  driftDays: number;
  mentionMult: number;
  sentimentToday: number | null;
  sentimentBaselineShift: number;
  volumeMult: number;
  newsMult: number;
  gap: number;
}

function storyShape(story: Story, rng: Rng, dailyVol: number): StoryShape {
  const base: StoryShape = {
    drift: 0,
    driftDays: 0,
    mentionMult: 1,
    sentimentToday: null,
    sentimentBaselineShift: 0,
    volumeMult: 1,
    newsMult: 1,
    gap: 0,
  };
  switch (story) {
    case "buzz-bull":
      return { ...base, drift: rng.range(0.006, 0.012), driftDays: 6, mentionMult: rng.range(3.5, 6), sentimentToday: rng.range(0.35, 0.6), volumeMult: rng.range(1.8, 2.6), newsMult: 2.2, gap: rng.range(0.01, 0.03) };
    case "buzz-bear":
      return { ...base, drift: -rng.range(0.008, 0.014), driftDays: 6, mentionMult: rng.range(3, 5), sentimentToday: -rng.range(0.3, 0.55), volumeMult: rng.range(1.8, 2.8), newsMult: 2.5, gap: -rng.range(0.02, 0.05) };
    case "momentum-up":
      return { ...base, drift: rng.range(0.55, 0.8) * dailyVol, driftDays: 20, mentionMult: rng.range(1.3, 1.7), sentimentToday: rng.range(0.25, 0.4), volumeMult: rng.range(1.3, 1.6), newsMult: 1.6 };
    case "momentum-down":
      return { ...base, drift: -rng.range(0.5, 0.75) * dailyVol, driftDays: 20, mentionMult: rng.range(1.3, 1.6), sentimentToday: -rng.range(0.2, 0.35), volumeMult: rng.range(1.3, 1.6), newsMult: 1.7 };
    case "sentiment-flip": {
      const up = rng.chance(0.6);
      return { ...base, drift: up ? 0.003 : -0.003, driftDays: 5, mentionMult: rng.range(1.2, 1.5), sentimentToday: up ? rng.range(0.35, 0.55) : -rng.range(0.3, 0.5), sentimentBaselineShift: up ? -0.2 : 0.2, volumeMult: 1.3, newsMult: 1.3 };
    }
    case "news": {
      const up = rng.chance(0.6);
      return { ...base, mentionMult: rng.range(1.4, 1.8), volumeMult: rng.range(2, 2.6), newsMult: rng.range(4, 6), gap: up ? rng.range(0.02, 0.05) : -rng.range(0.02, 0.05), sentimentToday: up ? rng.range(0.2, 0.4) : -rng.range(0.2, 0.4) };
    }
    case "volume":
      return { ...base, mentionMult: rng.range(1.3, 1.6), volumeMult: rng.range(3.2, 4), gap: rng.range(-0.035, 0.045), newsMult: 1.8, sentimentToday: rng.range(-0.2, 0.3) };
    default:
      return base;
  }
}

/** Typische Kursspannen je Größenklasse (Demo). */
const PRICE_RANGE: Record<SizeClass, [number, number]> = {
  mega: [60, 700],
  large: [25, 520],
  mid: [8, 180],
  small: [1.5, 45],
};

function targetPrice(instrument: Instrument): number {
  const known = PRICE[instrument.symbol];
  if (known) return known;
  const rng = createRng(`price:${instrument.symbol}`);
  const [lo, hi] = PRICE_RANGE[instrument.size];
  return Math.round(Math.exp(rng.range(Math.log(lo), Math.log(hi))) * 100) / 100;
}

export function annualVolatility(instrument: Instrument): number {
  return SECTOR_VOL[instrument.sector] * SIZE_VOL[instrument.size] * (VOL_MULT[instrument.symbol] ?? 1);
}

/** Anteil der Sekunden mit Handel im Demo-Livebetrieb. */
const LIQUIDITY: Record<SizeClass, number> = { mega: 0.85, large: 0.65, mid: 0.4, small: 0.22 };

/** Parameter der Live-Simulation: Referenz ist der Schlusskurs der Mock-Serie. */
export function simParams(instrument: Instrument, data: MockInstrumentData): SimParams {
  return {
    key: instrument.symbol,
    base: data.daily[data.daily.length - 1]!.c,
    dailyVol: annualVolatility(instrument) / Math.sqrt(252),
    liquidity: LIQUIDITY[instrument.size] * (instrument.region === "DE" ? 0.8 : 1),
  };
}

export function indexSimParams(index: IndexDef, data: { daily: Candle[] }): SimParams {
  return { key: `index:${index.id}`, base: data.daily[data.daily.length - 1]!.c, dailyVol: 0.009, liquidity: 1 };
}

function baseVolume(instrument: Instrument): number {
  const capUsd = instrument.currency === "EUR" ? instrument.marketCapBn * EUR_USD : instrument.marketCapBn;
  const price = targetPrice(instrument);
  // Umschlag ≈ 0,4 % der Marktkapitalisierung pro Tag (US), 0,25 % (DE); kleine Werte drehen schneller
  const sizeTurnover = instrument.size === "small" ? 2 : instrument.size === "mid" ? 1.4 : 1;
  const turnover = capUsd * 1e9 * (instrument.region === "US" ? 0.004 : 0.0025) * sizeTurnover;
  return (turnover / price) * Math.sqrt(socialAffinity(instrument.symbol));
}

function intradayProfile(i: number, n: number): number {
  // U-förmiges Volumenprofil über den Handelstag
  const x = i / Math.max(n - 1, 1);
  return 0.6 + 1.8 * (x - 0.5) ** 2 * 4;
}

const memo = new Map<string, MockInstrumentData>();

export function generateInstrument(instrument: Instrument, nowMs: number): MockInstrumentData {
  const sessions = tradingDays(instrument.region, nowMs, HISTORY_DAYS);
  const latest = sessions[sessions.length - 1]!;
  const key = `${instrument.symbol}:${latest.day}:${latest.isOpen ? Math.floor(nowMs / 300_000) : "closed"}`;
  const hit = memo.get(key);
  if (hit) return hit;
  if (memo.size > 2000) memo.clear();

  const data = buildInstrument(instrument, sessions, nowMs);
  memo.set(key, data);
  return data;
}

function buildInstrument(instrument: Instrument, sessions: Session[], nowMs: number): MockInstrumentData {
  const sym = instrument.symbol;
  const rng = createRng(`series:${sym}`);
  const story = storyFor(instrument);
  const n = sessions.length;
  const latest = sessions[n - 1]!;

  const annualVol = annualVolatility(instrument) * rng.range(0.85, 1.15);
  const dailyVol = annualVol / Math.sqrt(252);
  const shape = storyShape(story, createRng(`shape:${sym}`), dailyVol);
  const drift = rng.normal(0.09, 0.08) / 252;
  const beta = rng.range(0.7, 1.35) * Math.sqrt(VOL_MULT[sym] ?? 1);
  const mkt = marketFactor(instrument.region, n);
  const sec = sectorFactor(instrument.sector, n);
  const idioVol = Math.sqrt(Math.max(dailyVol ** 2 - (beta * 0.009) ** 2 - 0.006 ** 2, (dailyVol * 0.4) ** 2));

  // Renditen erzeugen
  const rets: number[] = [];
  for (let i = 0; i < n; i++) {
    const fromEnd = n - 1 - i;
    // Im Story-Fenster dominiert der Trend (gedämpftes Rauschen), damit die
    // kuratierten Beispiele das zeigen, was ihre Story verspricht.
    const inStory = fromEnd < shape.driftDays;
    const noise = inStory ? 0.45 : 1;
    let r = drift + noise * (beta * (mkt[i] ?? 0) + (sec[i] ?? 0) + rng.normal(0, idioVol));
    if (inStory) r += shape.drift;
    if (fromEnd === 0) r += shape.gap;
    // gelegentliche Sprünge (Quartalszahlen)
    if (rng.chance(1 / 63)) r += rng.normal(0, dailyVol * 3);
    rets.push(Math.max(r, -0.5));
  }

  // Rückwärts vom Zielkurs aufbauen
  const closes = new Array<number>(n);
  closes[n - 1] = targetPrice(instrument);
  for (let i = n - 1; i > 0; i--) closes[i - 1] = closes[i]! / (1 + rets[i]!);

  // Tagesvolumen
  const v0 = baseVolume(instrument);
  const volumes: number[] = [];
  for (let i = 0; i < n; i++) {
    const fromEnd = n - 1 - i;
    const moveBoost = 1 + 6 * Math.abs(rets[i]!);
    let v = v0 * Math.exp(rng.normal(0, 0.22)) * moveBoost;
    if (fromEnd === 0) v *= shape.volumeMult;
    else if (fromEnd < shape.driftDays) v *= 1 + (shape.volumeMult - 1) * 0.35;
    volumes.push(Math.round(v));
  }

  // Intraday der letzten Sitzung (Brownsche Brücke vom Eröffnungs- zum Schlusskurs)
  const prevClose = closes[n - 2]!;
  const lastClose = closes[n - 1]!;
  const barsTotal = Math.round((latest.close - latest.open) / 300_000);
  const barsNow = latest.isOpen ? Math.max(1, Math.floor((nowMs - latest.open) / 300_000)) : barsTotal;
  const openPrice = prevClose * (1 + shape.gap * 0.6 + rng.normal(0, dailyVol * 0.3));
  const intraday: Candle[] = [];
  {
    const irng = createRng(`intraday:${sym}:${latest.day}`);
    const steps: number[] = [];
    let acc = 0;
    for (let i = 0; i < barsNow; i++) {
      acc += irng.normal(0, 1);
      steps.push(acc);
    }
    const endNoise = steps[barsNow - 1] ?? 0;
    const sigma = dailyVol / Math.sqrt(barsTotal) * 0.9;
    let prev = openPrice;
    for (let i = 0; i < barsNow; i++) {
      const frac = (i + 1) / barsNow;
      const bridge = (steps[i]! - frac * endNoise) * sigma;
      const trend = Math.log(openPrice) + frac * (Math.log(lastClose) - Math.log(openPrice));
      const c = Math.exp(trend + bridge);
      const wiggle = Math.abs(irng.normal(0, sigma * 0.6)) * c;
      const o = prev;
      intraday.push({
        t: Math.floor((latest.open + i * 300_000) / 1000),
        o,
        h: Math.max(o, c) + wiggle,
        l: Math.min(o, c) - wiggle,
        c,
        v: Math.round((volumes[n - 1]! / barsTotal) * intradayProfile(i, barsTotal) * Math.exp(irng.normal(0, 0.3))),
      });
      prev = c;
    }
    const last = intraday[intraday.length - 1];
    if (last) last.c = lastClose;
  }

  // Tageskerzen
  const daily: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const c = closes[i]!;
    const o = i === 0 ? c : i === n - 1 ? openPrice : closes[i - 1]! * (1 + rng.normal(0, dailyVol * 0.25));
    const range = Math.abs(rng.normal(0, dailyVol * 0.6)) * c;
    let h = Math.max(o, c) + range * 0.5;
    let l = Math.min(o, c) - range * 0.5;
    if (i === n - 1 && intraday.length > 0) {
      h = Math.max(...intraday.map((b) => b.h));
      l = Math.min(...intraday.map((b) => b.l));
    }
    daily.push({ t: sessions[i]!.day, o, h, l, c, v: volumes[i]! });
  }
  if (latest.isOpen) {
    // Laufende Sitzung: bisheriges Volumen
    const d = daily[n - 1]!;
    d.v = intraday.reduce((a, b) => a + b.v, 0);
  }

  // Social: Kalendertage vom ersten Handelstag bis heute
  const firstDay = sessions[0]!.day;
  const lastDay = latest.day;
  const calendarDays = Math.round((lastDay - firstDay) / DAY_S) + 1;
  const retByDay = new Map<number, number>();
  sessions.forEach((s, i) => retByDay.set(s.day, rets[i]!));

  const srng = createRng(`social:${sym}`);
  const affinity = socialAffinity(sym);
  const capUsd = instrument.currency === "EUR" ? instrument.marketCapBn * EUR_USD : instrument.marketCapBn;
  const regionFactor = instrument.region === "US" ? 1 : 0.22;
  const baseMentions = (6 + 26 * Math.pow(capUsd / 100, 0.45)) * affinity * regionFactor;
  const baseSentiment = srng.normal(0.08, 0.1) + (affinity > 3 ? 0.05 : 0);
  let hype = 0;
  let sentAr = 0;
  const social: SocialDay[] = [];
  const newsDaily: number[] = [];
  const newsBase = Math.max(0.4, 1 + 5 * Math.sqrt(capUsd / 1000)) * (instrument.region === "US" ? 1 : 0.8);
  const nrng = createRng(`news:${sym}`);

  for (let d = 0; d < calendarDays; d++) {
    const t = firstDay + d * DAY_S;
    const fromEnd = calendarDays - 1 - d;
    const dow = new Date(t * 1000).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const r = retByDay.get(t) ?? 0;
    hype = 0.93 * hype + srng.normal(0, 0.16);
    const moveBoost = 1 + 18 * Math.abs(r) * Math.min(affinity, 4) ** 0.5;
    let lambda = baseMentions * Math.exp(0.5 * hype) * (weekend ? 0.55 : 1) * moveBoost;
    // Ruhige Basislinie der letzten 30 Tage für saubere Z-Scores
    if (fromEnd > 0 && fromEnd <= 31) lambda = baseMentions * (weekend ? 0.55 : 1) * (1 + 6 * Math.abs(r)) * Math.exp(0.15 * hype);
    if (fromEnd === 0) lambda = baseMentions * shape.mentionMult * (1 + 4 * Math.abs(r));
    else if (fromEnd <= 2 && shape.mentionMult > 2) lambda *= 1 + (shape.mentionMult - 1) * 0.15;
    const mentions = Math.max(0, Math.round(lambda * Math.exp(srng.normal(0, 0.18))));

    sentAr = 0.7 * sentAr + srng.normal(0, 0.06);
    let sentiment = baseSentiment + sentAr + 2.5 * r;
    if (fromEnd >= 1 && fromEnd <= 7) sentiment += shape.sentimentBaselineShift;
    if (fromEnd === 0 && shape.sentimentToday !== null) sentiment = shape.sentimentToday;
    sentiment = Math.max(-0.9, Math.min(0.9, sentiment));
    social.push({ t, mentions, sentiment: mentions >= 2 ? Math.round(sentiment * 1000) / 1000 : null });

    let nl = newsBase * (weekend ? 0.3 : 1) * (1 + 10 * Math.abs(r));
    if (fromEnd <= 1) nl = newsBase * (weekend ? 0.5 : 1) * shape.newsMult;
    newsDaily.push(nrng.poisson(nl));
  }

  // Stündliche Erwähnungen (letzte 48 Std.)
  const hourly: { t: number; mentions: number }[] = [];
  {
    const hrng = createRng(`hourly:${sym}:${lastDay}`);
    const endHour = Math.floor(Math.min(nowMs, latest.close + 4 * 3_600_000) / 3_600_000);
    for (let h = endHour - 47; h <= endHour; h++) {
      const t = h * 3600;
      const dayIdx = Math.round((Math.floor(t / DAY_S) * DAY_S - firstDay) / DAY_S);
      const dayTotal = social[Math.min(Math.max(dayIdx, 0), social.length - 1)]?.mentions ?? 0;
      const hourUtc = new Date(t * 1000).getUTCHours();
      const active = instrument.region === "US" ? hourUtc >= 13 && hourUtc <= 22 : hourUtc >= 6 && hourUtc <= 17;
      const share = (active ? 1.8 : 0.45) / 24;
      hourly.push({ t, mentions: hrng.poisson(dayTotal * share) });
    }
  }

  const sourcesRng = createRng(`sources:${sym}`);
  const sources =
    instrument.region === "US"
      ? normalizeShares([
          { name: "r/wallstreetbets", share: sourcesRng.range(0.3, 0.55) * (affinity > 3 ? 1.3 : 0.8) },
          { name: "r/stocks", share: sourcesRng.range(0.15, 0.3) },
          { name: "r/investing", share: sourcesRng.range(0.1, 0.2) },
          { name: "r/StockMarket", share: sourcesRng.range(0.08, 0.15) },
        ])
      : normalizeShares([
          { name: "r/mauerstrassenwetten", share: sourcesRng.range(0.3, 0.5) },
          { name: "r/Finanzen", share: sourcesRng.range(0.2, 0.35) },
          { name: "r/aktien", share: sourcesRng.range(0.15, 0.3) },
        ]);

  const socialData: SocialData = { daily: social, hourly, sources };
  const referenceMs = Math.min(nowMs, latest.isOpen ? nowMs : latest.close + 3 * 3_600_000);

  return {
    story,
    daily,
    intraday,
    social: socialData,
    newsDaily,
    news: buildNews(instrument, social, newsDaily, shape, referenceMs),
    discussions: buildDiscussions(instrument, shape, referenceMs, social[social.length - 1]?.mentions ?? 0),
    fundamentals: buildFundamentals(instrument, daily, annualVol),
    sessions,
  };
}

function normalizeShares(items: { name: string; share: number }[]): { name: string; share: number }[] {
  const total = items.reduce((a, b) => a + b.share, 0);
  return items.map((i) => ({ ...i, share: i.share / total })).sort((a, b) => b.share - a.share);
}

function toneFor(sentiment: number | null, rng: Rng): Tone {
  const s = sentiment ?? 0;
  const x = rng.next();
  const pPos = 0.33 + s * 0.6;
  const pNeg = 0.33 - s * 0.6;
  if (x < pPos) return "pos";
  if (x < pPos + Math.max(pNeg, 0.05)) return "neg";
  return "neu";
}

function buildNews(
  instrument: Instrument,
  social: SocialDay[],
  newsDaily: number[],
  shape: StoryShape,
  referenceMs: number,
): NewsItem[] {
  const rng = createRng(`newsitems:${instrument.symbol}`);
  const items: NewsItem[] = [];
  const usedHeadlines = new Set<string>();
  const days = Math.min(7, newsDaily.length);
  for (let k = 0; k < days; k++) {
    const idx = newsDaily.length - 1 - k;
    const count = Math.min(newsDaily[idx] ?? 0, k < 2 ? 5 : 2);
    const dayStart = (social[idx]?.t ?? 0) * 1000;
    const sentiment = k === 0 && shape.sentimentToday !== null ? shape.sentimentToday : (social[idx]?.sentiment ?? 0);
    for (let j = 0; j < count; j++) {
      const wanted = toneFor(sentiment, rng);
      const tone = [wanted, "neu" as Tone, "pos" as Tone, "neg" as Tone].find((t) =>
        NEWS_HEADLINES[t].some((h) => !usedHeadlines.has(h)),
      );
      if (!tone) break;
      const template = rng.pick(NEWS_HEADLINES[tone].filter((h) => !usedHeadlines.has(h)));
      usedHeadlines.add(template);
      const headline = fill(template, instrument.ticker, instrument.name);
      const hour = rng.range(6, 21);
      const publishedAt = Math.min(dayStart + hour * 3_600_000, referenceMs - rng.range(5, 90) * 60_000);
      const query = encodeURIComponent(`${instrument.name} Aktie`);
      items.push({
        id: `${instrument.symbol}-n-${idx}-${j}`,
        headline,
        summary: null,
        source: rng.pick(NEWS_SOURCES),
        url: `https://news.google.com/search?q=${query}&hl=de&gl=DE&ceid=DE:de`,
        publishedAt,
        sentiment: tone === "pos" ? 0.5 : tone === "neg" ? -0.5 : 0,
      });
    }
  }
  return items.sort((a, b) => b.publishedAt - a.publishedAt);
}

function buildDiscussions(instrument: Instrument, shape: StoryShape, referenceMs: number, mentionsToday: number): Discussion[] {
  const rng = createRng(`discussions:${instrument.symbol}`);
  const us = instrument.region === "US";
  const pool = us ? DISCUSSIONS_EN : DISCUSSIONS_DE;
  const communities = us
    ? ["r/wallstreetbets", "r/stocks", "r/investing", "r/StockMarket"]
    : ["r/mauerstrassenwetten", "r/Finanzen", "r/aktien"];
  const count = Math.min(8, 4 + Math.floor(Math.log10(mentionsToday + 1) * 1.5));
  const sentiment = shape.sentimentToday ?? rng.normal(0.08, 0.15);
  const out: Discussion[] = [];
  const used = new Set<string>();
  const order: Tone[] = ["pos", "neu", "neg"];
  for (let i = 0; i < count; i++) {
    const wanted = toneFor(sentiment, rng);
    // Keine doppelten Beiträge: ist ein Ton erschöpft, auf einen anderen ausweichen.
    const tone = [wanted, ...order.filter((t) => t !== wanted)].find((t) => pool[t].some((x) => !used.has(x.title)));
    if (!tone) break;
    const tpl = rng.pick(pool[tone].filter((t) => !used.has(t.title)));
    used.add(tpl.title);
    const community = rng.pick(communities);
    const text = fill(tpl.body, instrument.ticker, instrument.name);
    const sub = community.slice(2);
    const score = Math.round(Math.exp(rng.range(Math.log(12), Math.log(4800))) * (mentionsToday > 200 ? 1.5 : 1));
    out.push({
      id: `${instrument.symbol}-d-${i}`,
      source: "reddit",
      community,
      title: fill(tpl.title, instrument.ticker, instrument.name),
      snippet: text,
      url: `https://www.reddit.com/r/${sub}/search/?q=${encodeURIComponent(instrument.ticker)}&restrict_sr=1&sort=new`,
      score,
      comments: Math.round(score * rng.range(0.08, 0.5)),
      createdAt: referenceMs - Math.round(rng.range(0.2, 40) * 3_600_000),
      sentiment: lexiconSentiment(text).score,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

function buildFundamentals(instrument: Instrument, daily: Candle[], annualVol: number): Fundamentals {
  const rng = createRng(`fundamentals:${instrument.symbol}`);
  const lastYear = daily.slice(-252);
  const lossChance = instrument.size === "small" ? 0.45 : instrument.size === "mid" ? 0.2 : 0.03;
  const unprofitable = ["RIVN", "SNAP", "MRNA", "INTC"].includes(instrument.ticker) || rng.chance(lossChance);
  const pe = unprofitable ? null : Math.round(SECTOR_PE[instrument.sector] * Math.exp(rng.normal(0, 0.3)) * 10) / 10;
  const payer = !["tech", "communication"].includes(instrument.sector) || rng.chance(0.55);
  const div = payer ? Math.max(0, SECTOR_DIV[instrument.sector] * Math.exp(rng.normal(0, 0.35))) : 0;
  const avgVol = lastYear.slice(-60).reduce((a, c) => a + c.v, 0) / Math.max(1, Math.min(60, lastYear.length));
  return {
    marketCapBn: instrument.marketCapBn,
    pe,
    dividendYieldPct: Math.round(div * 100) / 100,
    beta: Math.round((annualVol / 0.2) * rng.range(0.8, 1.1) * 100) / 100,
    high52w: Math.max(...lastYear.map((c) => c.h)),
    low52w: Math.min(...lastYear.map((c) => c.l)),
    avgVolume: Math.round(avgVol),
  };
}

/* ------------------------------------------------------------------ */
/* Indizes                                                             */
/* ------------------------------------------------------------------ */

const INDEX_LEVEL: Record<IndexDef["id"], number> = { SPX: 6650, NDX: 24_500, DAX: 23_600 };

export function generateIndex(index: IndexDef, nowMs: number): { daily: Candle[]; intraday: Candle[] } {
  const sessions = tradingDays(index.region, nowMs, HISTORY_DAYS);
  const n = sessions.length;
  const latest = sessions[n - 1]!;
  const mkt = marketFactor(index.region, n);
  const tech = sectorFactor("tech", n);
  const rets = mkt.map((m, i) => (index.id === "NDX" ? 1.15 * m + 0.6 * (tech[i] ?? 0) + 0.0001 : m));
  const closes = new Array<number>(n);
  closes[n - 1] = INDEX_LEVEL[index.id] * (1 + (rets[n - 1] ?? 0));
  for (let i = n - 1; i > 0; i--) closes[i - 1] = closes[i]! / (1 + rets[i]!);
  const daily: Candle[] = closes.map((c, i) => ({ t: sessions[i]!.day, o: closes[i - 1] ?? c, h: c, l: c, c, v: 0 }));

  const rng = createRng(`index-intraday:${index.id}:${latest.day}`);
  const barsTotal = Math.round((latest.close - latest.open) / 300_000);
  const barsNow = latest.isOpen ? Math.max(1, Math.floor((nowMs - latest.open) / 300_000)) : barsTotal;
  const prev = closes[n - 2]!;
  const last = closes[n - 1]!;
  const intraday: Candle[] = [];
  let acc = 0;
  const steps: number[] = [];
  for (let i = 0; i < barsNow; i++) {
    acc += rng.normal(0, 1);
    steps.push(acc);
  }
  const end = steps[barsNow - 1] ?? 0;
  for (let i = 0; i < barsNow; i++) {
    const frac = (i + 1) / barsNow;
    const c = prev * Math.exp(frac * Math.log(last / prev) + (steps[i]! - frac * end) * 0.0009);
    intraday.push({ t: Math.floor((latest.open + i * 300_000) / 1000), o: c, h: c, l: c, c, v: 0 });
  }
  const tailBar = intraday[intraday.length - 1];
  if (tailBar) tailBar.c = last;
  return { daily, intraday };
}

/** 30-Minuten-Kerzen der letzten 5 Sitzungen (letzte Sitzung aus den 5-Minuten-Daten aggregiert). */
export function weekCandles(instrument: Instrument, data: MockInstrumentData): Candle[] {
  const out: Candle[] = [];
  const n = data.sessions.length;
  const vol = annualVolatility(instrument) / Math.sqrt(252);
  for (let k = 4; k >= 1; k--) {
    const s = data.sessions[n - 1 - k]!;
    const prevClose = data.daily[n - 2 - k]?.c ?? data.daily[n - 1 - k]!.o;
    const close = data.daily[n - 1 - k]!.c;
    const bars = Math.round((s.close - s.open) / 1_800_000);
    const rng = createRng(`week:${instrument.symbol}:${s.day}`);
    const steps: number[] = [];
    let acc = 0;
    for (let i = 0; i < bars; i++) {
      acc += rng.normal(0, 1);
      steps.push(acc);
    }
    const end = steps[bars - 1] ?? 0;
    const sigma = (vol / Math.sqrt(bars)) * 0.8;
    let prev = prevClose;
    for (let i = 0; i < bars; i++) {
      const frac = (i + 1) / bars;
      const c = Math.exp(Math.log(prevClose) + frac * Math.log(close / prevClose) + (steps[i]! - frac * end) * sigma);
      out.push({ t: Math.floor((s.open + i * 1_800_000) / 1000), o: prev, h: Math.max(prev, c), l: Math.min(prev, c), c, v: 0 });
      prev = c;
    }
    const lastBar = out[out.length - 1];
    if (lastBar) lastBar.c = close;
  }
  // Letzte Sitzung: 5-Minuten-Kerzen zu 30 Minuten bündeln
  const buckets = new Map<number, Candle>();
  for (const c of data.intraday) {
    const key = Math.floor(c.t / 1800) * 1800;
    const b = buckets.get(key);
    if (!b) buckets.set(key, { ...c, t: key });
    else {
      b.h = Math.max(b.h, c.h);
      b.l = Math.min(b.l, c.l);
      b.c = c.c;
      b.v += c.v;
    }
  }
  out.push(...[...buckets.values()].sort((a, b) => a.t - b.t));
  return out;
}
