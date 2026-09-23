import "server-only";
import { INDICES, UNIVERSE, getInstrument, marketCapUsdBn, type Instrument, type Region } from "@/config/universe";
import { latestSession, utcDayStart } from "@/lib/market-time";
import { lexiconAnalyzer } from "@/lib/providers/lexicon-analyzer";
import type { Candle, Discussion, NewsResult, SocialData } from "@/lib/providers/types";
import { computeSignal } from "@/lib/scoring/score";
import type { Signal, SignalInputs } from "@/lib/scoring/types";
import { sentimentLabel } from "@/lib/sentiment/lexicon";
import type {
  ChartData,
  ChartPoint,
  ChartRange,
  CompactSignal,
  DataStatus,
  DiscussionSummary,
  IndexRow,
  InstrumentDetail,
  InstrumentRow,
  Snapshot,
} from "@/lib/types";
import { cached } from "./cache";
import { mockScenario, nowMs } from "./clock";
import { getProviders } from "./registry";

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Cache-Laufzeiten je Datenart (ms). Echte Provider werden seltener gefragt. */
function ttl(kind: "quote" | "daily" | "intraday" | "social" | "news" | "fundamentals" | "snapshot" | "summary") {
  const demo = getProviders().demo;
  const table = {
    quote: demo ? MIN : 2 * MIN,
    intraday: demo ? MIN : 5 * MIN,
    daily: demo ? 10 * MIN : 6 * HOUR,
    social: demo ? 5 * MIN : 15 * MIN,
    news: demo ? 5 * MIN : 15 * MIN,
    fundamentals: 12 * HOUR,
    snapshot: demo ? MIN : 3 * MIN,
    summary: HOUR,
  } as const;
  return { ttl: table[kind], staleTtl: 24 * HOUR };
}

class ScenarioError extends Error {}

function assertScenario() {
  if (getProviders().demo && mockScenario() === "error") {
    throw new ScenarioError("Demo-Szenario: Datenquelle nicht erreichbar");
  }
}

/* ------------------------------------------------------------------ */
/* Rohdaten je Instrument (einzeln gecacht)                            */
/* ------------------------------------------------------------------ */

const SCORING_DAYS = 90;
const EMPTY_SOCIAL: SocialData = { daily: [], hourly: [], sources: [] };
const EMPTY_NEWS: NewsResult = { items: [], daily: [] };

function loadDaily(instrument: Instrument, days: number) {
  const p = getProviders().price(instrument);
  return cached(`daily:${p.id}:${instrument.symbol}:${days}`, () => p.getDailyCandles(instrument, days), ttl("daily"));
}

function loadQuote(instrument: Instrument) {
  const p = getProviders().price(instrument);
  return cached(`quote:${p.id}:${instrument.symbol}`, () => p.getQuote(instrument), ttl("quote"));
}

function loadSocial(instrument: Instrument) {
  const p = getProviders().social(instrument);
  return cached(`social:${p.id}:${instrument.symbol}`, () => p.getSocial(instrument), ttl("social"));
}

function loadNews(instrument: Instrument) {
  const p = getProviders().news(instrument);
  return cached(`news:${p.id}:${instrument.symbol}`, () => p.getNews(instrument, 40), ttl("news"));
}

function loadFundamentals(instrument: Instrument) {
  const p = getProviders().price(instrument);
  return cached(`fund:${p.id}:${instrument.symbol}`, () => p.getFundamentals(instrument), ttl("fundamentals"));
}

function isDemo(instrument: Instrument): boolean {
  const ps = getProviders();
  return ps.price(instrument).mock || ps.social(instrument).mock || ps.news(instrument).mock;
}

/* ------------------------------------------------------------------ */
/* Signal                                                              */
/* ------------------------------------------------------------------ */

export function signalInputs(daily: Candle[], social: SocialData, news: NewsResult): SignalInputs {
  const days = social.daily.slice(-41);
  return {
    mentionsDaily: days.map((d) => d.mentions),
    sentimentDaily: days.map((d) => d.sentiment),
    closes: daily.map((c) => c.c),
    volumes: daily.map((c) => c.v),
    newsDaily: news.daily,
  };
}

function compact(signal: Signal): CompactSignal {
  return {
    score: signal.score,
    type: signal.type,
    direction: signal.direction,
    headline: signal.headline,
    reason: signal.reasons[0] ?? "",
    highlights: signal.highlights.slice(0, 2),
    confidence: signal.confidence,
    flagged: signal.flagged,
  };
}

function pctChange(closes: number[], sessionsBack: number, latest: number): number {
  const ref = closes[closes.length - 1 - sessionsBack];
  return ref ? (latest / ref - 1) * 100 : NaN;
}

function round(v: number, digits = 4): number {
  if (!Number.isFinite(v)) return v;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

interface RowBundle {
  row: InstrumentRow;
  signal: Signal;
  stale: boolean;
  quoteTime: number;
}

async function buildRow(instrument: Instrument): Promise<RowBundle> {
  // Kurse sind Pflicht; Social und News dürfen fehlen (Komponenten werden dann
  // als „ohne Daten“ ausgewiesen und ihr Gewicht verteilt).
  const [daily, quote, social, news] = await Promise.all([
    loadDaily(instrument, SCORING_DAYS),
    loadQuote(instrument),
    loadSocial(instrument).catch(() => ({ value: EMPTY_SOCIAL, fetchedAt: 0, stale: true })),
    loadNews(instrument).catch(() => ({ value: EMPTY_NEWS, fetchedAt: 0, stale: true })),
  ]);
  const closes = daily.value.map((c) => c.c);
  // Kursreihe mit aktuellem Kurs synchronisieren
  if (closes.length > 0 && Number.isFinite(quote.value.price)) closes[closes.length - 1] = quote.value.price;
  const signal = computeSignal(signalInputs(daily.value, social.value, news.value));
  const days = social.value.daily;
  const today = days[days.length - 1];
  const baselineDays = days.slice(-31, -1);
  const baseline = baselineDays.reduce((a, d) => a + d.mentions, 0) / Math.max(1, baselineDays.length);
  const mentions24h = today?.mentions ?? 0;

  const row: InstrumentRow = {
    symbol: instrument.symbol,
    ticker: instrument.ticker,
    name: instrument.name,
    sector: instrument.sector,
    region: instrument.region,
    exchange: instrument.exchange,
    currency: instrument.currency,
    price: round(quote.value.price),
    change1D: round(quote.value.change),
    changePct1D: round(quote.value.changePct),
    changePct1W: round(pctChange(closes, 5, quote.value.price)),
    changePct1M: round(pctChange(closes, 21, quote.value.price)),
    capUsdBn: marketCapUsdBn(instrument, instrument.marketCapBn),
    spark: closes.slice(-30).map((v) => round(v, 3)),
    mentions24h,
    mentionsBaseline: round(baseline, 1),
    buzzChangePct: round(baseline > 0 ? (mentions24h / baseline - 1) * 100 : 0, 1),
    sentiment: today?.sentiment ?? null,
    signal: compact(signal),
    demo: isDemo(instrument),
  };
  return {
    row,
    signal,
    stale: daily.stale || quote.stale || social.stale || news.stale,
    quoteTime: quote.value.time,
  };
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]!) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/* ------------------------------------------------------------------ */
/* Snapshot                                                            */
/* ------------------------------------------------------------------ */

function marketOpenMap(now: number): Record<Region, boolean> {
  return { US: latestSession("US", now).isOpen, DE: latestSession("DE", now).isOpen };
}

async function buildIndices(): Promise<IndexRow[]> {
  const ps = getProviders();
  const now = nowMs();
  const rows = await Promise.all(
    INDICES.map(async (def) => {
      const [daily, intraday] = await Promise.all([
        cached(`idx-daily:${ps.index.id}:${def.id}`, () => ps.index.getIndexDaily(def, 5), ttl("daily")),
        cached(`idx-intraday:${ps.index.id}:${def.id}`, () => ps.index.getIndexIntraday(def), ttl("intraday")),
      ]);
      const d = daily.value;
      const last = intraday.value[intraday.value.length - 1]?.c ?? d[d.length - 1]?.c ?? NaN;
      const prev = d[d.length - 2]?.c ?? last;
      const row: IndexRow = {
        id: def.id,
        name: def.name,
        currency: def.currency,
        value: round(last, 2),
        change: round(last - prev, 2),
        changePct: round((last / prev - 1) * 100, 3),
        spark: intraday.value.filter((_, i) => i % 3 === 0).map((c) => round(c.c, 2)),
        marketOpen: latestSession(def.region, now).isOpen,
        demo: ps.index.mock,
      };
      return row;
    }),
  );
  return rows;
}

async function buildSnapshot(): Promise<Snapshot> {
  assertScenario();
  const ps = getProviders();
  const results = await mapLimit(UNIVERSE, 12, buildRow);
  const bundles = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const failed = results.length - bundles.length;
  if (bundles.length === 0) {
    const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw first?.reason instanceof Error ? first.reason : new Error("Keine Daten verfügbar");
  }
  const indices = await buildIndices().catch(() => [] as IndexRow[]);
  const now = nowMs();
  const notes: string[] = [];
  if (failed > 0) notes.push(`${failed} von ${UNIVERSE.length} Werten konnten nicht geladen werden (Rate-Limit oder Anbieterlücke).`);
  const scenarioStale = ps.demo && mockScenario() === "stale";
  const asOf = scenarioStale ? now - 3 * HOUR : Math.max(...bundles.map((b) => b.quoteTime));

  const status: DataStatus = {
    asOf,
    generatedAt: now,
    stale: scenarioStale || bundles.some((b) => b.stale),
    demo: ps.demo,
    marketOpen: marketOpenMap(now),
    sources: ps.active.map(({ id, label, mock, attribution }) => ({ id, label, mock, attribution })),
    coverage: { loaded: bundles.length, total: UNIVERSE.length },
    notes,
  };
  return { status, rows: bundles.map((b) => b.row), indices };
}

export async function getSnapshot(): Promise<Snapshot> {
  const res = await cached("snapshot", buildSnapshot, ttl("snapshot"));
  if (!res.stale) return res.value;
  return { ...res.value, status: { ...res.value.status, stale: true } };
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

const RANGE_DAYS: Record<Exclude<ChartRange, "1D" | "1W">, number> = { "1M": 22, "6M": 126, "1Y": 252, "5Y": 1260 };

/** Weist Erwähnungen (Tageswerte) den Kerzen zu; Wochenend-Erwähnungen zählen zum nächsten Handelstag. */
function mentionsPerCandle(candles: Candle[], social: SocialData): ChartPoint[] {
  if (candles.length === 0) return [];
  const out: ChartPoint[] = [];
  let di = 0;
  const days = social.daily;
  // Erste Kerze: nur Erwähnungen des eigenen Tages
  const firstT = candles[0]!.t;
  while (di < days.length && days[di]!.t < utcDayStart(firstT * 1000)) di++;
  for (const c of candles) {
    const bucketEnd = utcDayStart(c.t * 1000) + 86_400;
    let sum = 0;
    let any = false;
    while (di < days.length && days[di]!.t < bucketEnd) {
      sum += days[di]!.mentions;
      any = true;
      di++;
    }
    if (any) out.push({ t: c.t, v: sum });
  }
  return out;
}

function weekly(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (const c of candles) {
    const d = new Date(c.t * 1000);
    const monday = utcDayStart(c.t * 1000) - ((d.getUTCDay() + 6) % 7) * 86_400;
    const last = out[out.length - 1];
    if (last && utcDayStart(last.t * 1000) - ((new Date(last.t * 1000).getUTCDay() + 6) % 7) * 86_400 === monday) {
      last.c = c.c;
      last.h = Math.max(last.h, c.h);
      last.l = Math.min(last.l, c.l);
      last.v += c.v;
    } else {
      out.push({ ...c });
    }
  }
  return out;
}

async function buildChart(instrument: Instrument, range: ChartRange): Promise<ChartData> {
  const ps = getProviders();
  const price = ps.price(instrument);
  const social = await loadSocial(instrument).then(
    (r) => r.value,
    () => EMPTY_SOCIAL,
  );
  const quote = (await loadQuote(instrument)).value;

  if (range === "1D") {
    const candles = (
      await cached(`intraday:${price.id}:${instrument.symbol}`, () => price.getIntradayCandles(instrument), ttl("intraday"))
    ).value;
    const hourly = new Map(social.hourly.map((h) => [h.t, h.mentions]));
    const mentions: ChartPoint[] = [];
    const seenHours = new Set<number>();
    for (const c of candles) {
      const hour = Math.floor(c.t / 3600) * 3600;
      if (seenHours.has(hour)) continue;
      seenHours.add(hour);
      const m = hourly.get(hour);
      if (m !== undefined) mentions.push({ t: c.t, v: m });
    }
    return {
      range,
      points: candles.map((c) => ({ t: c.t, v: round(c.c) })),
      mentions,
      baseline: quote.prevClose,
      intraday: true,
      currency: instrument.currency,
    };
  }

  if (range === "1W") {
    const candles = (
      await cached(`week:${price.id}:${instrument.symbol}`, () => price.getWeekCandles(instrument), ttl("intraday"))
    ).value;
    const firstBarOfDay = new Map<number, number>();
    for (const c of candles) {
      const day = utcDayStart(c.t * 1000);
      if (!firstBarOfDay.has(day)) firstBarOfDay.set(day, c.t);
    }
    const mentions: ChartPoint[] = social.daily
      .filter((d) => firstBarOfDay.has(d.t))
      .map((d) => ({ t: firstBarOfDay.get(d.t)!, v: d.mentions }));
    const first = candles[0];
    return {
      range,
      points: candles.map((c) => ({ t: c.t, v: round(c.c) })),
      mentions,
      baseline: first ? first.o : quote.prevClose,
      intraday: true,
      currency: instrument.currency,
    };
  }

  const days = RANGE_DAYS[range];
  let candles = (await loadDaily(instrument, days + 1)).value;
  const baselineCandle = candles.length > days ? candles[0] : undefined;
  candles = candles.slice(-days);
  if (candles.length > 0 && Number.isFinite(quote.price)) {
    const last = candles[candles.length - 1]!;
    candles[candles.length - 1] = { ...last, c: quote.price };
  }
  if (range === "5Y") candles = weekly(candles);
  const mentions = mentionsPerCandle(range === "5Y" ? candles : candles, social);
  if (range === "5Y") {
    // Wochensummen statt Tageswerten
    const weeklyMentions: ChartPoint[] = [];
    const starts = candles.map((c) => c.t);
    let wi = 0;
    for (const d of social.daily) {
      while (wi + 1 < starts.length && d.t >= utcDayStart(starts[wi + 1]! * 1000)) wi++;
      if (d.t < utcDayStart(starts[0]! * 1000)) continue;
      const t = starts[wi]!;
      const last = weeklyMentions[weeklyMentions.length - 1];
      if (last && last.t === t) last.v += d.mentions;
      else weeklyMentions.push({ t, v: d.mentions });
    }
    return {
      range,
      points: candles.map((c) => ({ t: c.t, v: round(c.c) })),
      mentions: weeklyMentions,
      baseline: candles[0]?.c ?? quote.prevClose,
      intraday: false,
      currency: instrument.currency,
    };
  }
  return {
    range,
    points: candles.map((c) => ({ t: c.t, v: round(c.c) })),
    mentions,
    baseline: baselineCandle?.c ?? candles[0]?.c ?? quote.prevClose,
    intraday: false,
    currency: instrument.currency,
  };
}

export async function getChart(symbol: string, range: ChartRange): Promise<ChartData | null> {
  assertScenario();
  const instrument = getInstrument(symbol);
  if (!instrument) return null;
  return buildChart(instrument, range);
}

/* ------------------------------------------------------------------ */
/* Detailseite                                                         */
/* ------------------------------------------------------------------ */

export async function getInstrumentDetail(symbol: string): Promise<InstrumentDetail | null> {
  assertScenario();
  const instrument = getInstrument(symbol);
  if (!instrument) return null;
  const ps = getProviders();
  const now = nowMs();

  const [bundle, fundamentals, social, news, chart] = await Promise.all([
    buildRow(instrument),
    loadFundamentals(instrument),
    loadSocial(instrument).catch(() => ({ value: EMPTY_SOCIAL, fetchedAt: 0, stale: true })),
    loadNews(instrument).catch(() => ({ value: EMPTY_NEWS, fetchedAt: 0, stale: true })),
    buildChart(instrument, "1M"),
  ]);
  const quote = (await loadQuote(instrument)).value;

  const socialProvider = ps.social(instrument);
  const rawDiscussions = await cached(
    `discussions:${socialProvider.id}:${instrument.symbol}`,
    () => socialProvider.getDiscussions(instrument, 8),
    ttl("social"),
  ).then(
    (r) => r.value,
    () => [] as Discussion[],
  );

  const analysis = await summarizeDiscussions(instrument, rawDiscussions);
  const discussions = analysis.sentiments
    ? rawDiscussions.map((d, i) => ({ ...d, sentiment: analysis.sentiments?.[i] ?? d.sentiment }))
    : rawDiscussions;
  const summary = analysis.summary;

  const labels = discussions.map((d) => sentimentLabel(d.sentiment));
  const total = Math.max(1, labels.length);
  const positive = labels.filter((l) => l === "positiv").length / total;
  const negative = labels.filter((l) => l === "negativ").length / total;

  const scenarioStale = ps.demo && mockScenario() === "stale";
  const status: DataStatus = {
    asOf: scenarioStale ? now - 3 * HOUR : quote.time,
    generatedAt: now,
    stale: scenarioStale || bundle.stale || fundamentals.stale || social.stale || news.stale,
    demo: bundle.row.demo,
    marketOpen: marketOpenMap(now),
    sources: [
      ps.price(instrument),
      ps.social(instrument),
      ps.news(instrument),
      ps.analyzer,
    ].map(({ id, label, mock, attribution }) => ({ id, label, mock, attribution })),
    coverage: { loaded: 1, total: 1 },
    notes: [],
  };

  return {
    row: bundle.row,
    quote,
    fundamentals: fundamentals.value,
    signal: bundle.signal,
    chart,
    sentimentDays: social.value.daily.slice(-30).map((d) => ({ t: d.t, sentiment: d.sentiment, mentions: d.mentions })),
    sentimentBreakdown: { positive, neutral: labels.length ? 1 - positive - negative : 0, negative },
    socialSources: social.value.sources,
    discussions,
    news: news.value.items.slice(0, 10),
    summary,
    status,
  };
}

/**
 * Zusammenfassung der Diskussionen: KI (falls konfiguriert), bei Fehler,
 * Ablehnung oder Rate-Limit automatisch Lexikon-Fallback.
 */
async function summarizeDiscussions(
  instrument: Instrument,
  discussions: Discussion[],
): Promise<{ summary: DiscussionSummary | null; sentiments?: number[] }> {
  if (discussions.length === 0) return { summary: null };
  const ps = getProviders();
  const key = `summary:${ps.analyzer.id}:${instrument.symbol}:${discussions.map((d) => d.id).join(",")}`;
  if (ps.analyzer.id !== lexiconAnalyzer.id) {
    try {
      const res = await cached(key, () => ps.analyzer.summarize(instrument, discussions), ttl("summary"));
      if (res.value) return { summary: { text: res.value.text, method: "ai" }, sentiments: res.value.sentiments };
    } catch {
      // Fallback unten
    }
  }
  const lex = await lexiconAnalyzer.summarize(instrument, discussions);
  return { summary: lex ? { text: lex.text, method: "lexicon" } : null };
}

export function allSymbols(): string[] {
  return UNIVERSE.map((i) => i.symbol);
}

export function providersAreDemo(): boolean {
  return getProviders().demo;
}
