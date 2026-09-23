import "server-only";
import {
  INDICES,
  UNIVERSE,
  getInstrument,
  isIndexId,
  isSizeClass,
  marketCapUsdBn,
  type Instrument,
  type Region,
} from "@/config/universe";
import { latestSession, utcDayStart } from "@/lib/market-time";
import { lexiconAnalyzer } from "@/lib/providers/lexicon-analyzer";
import type { Candle, Discussion, NewsResult, Quote, SocialData } from "@/lib/providers/types";
import { computeSignal } from "@/lib/scoring/score";
import type { Signal, SignalInputs } from "@/lib/scoring/types";
import { sentimentLabel } from "@/lib/sentiment/lexicon";
import { dailyMoveZ, isRelevant } from "@/lib/relevance";
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
import { cached, peek, type CacheResult } from "./cache";
import { mockScenario, nowMs } from "./clock";
import { RateLimitError, withLimiterBudget } from "./rate-limit";
import { getProviders } from "./registry";

const MIN = 60_000;
const HOUR = 60 * MIN;

/* ------------------------------------------------------------------ */
/* Scan-Umfang                                                         */
/* ------------------------------------------------------------------ */

/**
 * Welche Werte der Snapshot (Start, Heatmap, Entdecken) laufend auswertet.
 * `SCAN_UNIVERSE` = Liste aus Größenklassen (mega, large, mid, small), Indizes
 * (DAX, MDAX, SDAX), Regionen (US, DE) oder `all`; ein Wert wird gescannt, wenn
 * er auf einen Eintrag passt. Demo: alles. Echte Provider: Mega/Large Caps + DAX,
 * weil Gratis-Kontingente (z. B. Twelve Data 800/Tag) nicht für >500 Werte reichen.
 * Nicht gescannte Werte bleiben über Suche, Detailseite und Watchlist erreichbar.
 */
let scanMemo: { key: string; list: readonly Instrument[] } | null = null;

export function scanUniverse(): readonly Instrument[] {
  const demo = getProviders().demo;
  const key = `${demo}:${process.env.SCAN_UNIVERSE ?? ""}`;
  if (scanMemo?.key === key) return scanMemo.list;
  const raw = (process.env.SCAN_UNIVERSE ?? (demo ? "all" : "mega,large,DAX")).split(",").map((t) => t.trim());
  const tokens = raw.filter(Boolean);
  const list =
    tokens.length === 0 || tokens.some((t) => t.toLowerCase() === "all")
      ? UNIVERSE
      : UNIVERSE.filter((i) =>
          tokens.some((t) => {
            const lower = t.toLowerCase();
            const upper = t.toUpperCase();
            if (isSizeClass(lower)) return i.size === lower;
            if (isIndexId(upper)) return i.index === upper;
            return upper === i.region;
          }),
        );
  scanMemo = { key, list: list.length > 0 ? list : UNIVERSE };
  return scanMemo.list;
}

/** Cache-Laufzeiten je Datenart (ms). Echte Provider werden seltener gefragt. */
function ttl(kind: "quote" | "daily" | "intraday" | "social" | "news" | "fundamentals" | "snapshot" | "summary") {
  const demo = getProviders().demo;
  // Kurse im Snapshot: Rotation so langsam, dass das Minutenlimit (Finnhub 60/Min.)
  // Luft für Detailseiten und Live-Abfragen lässt.
  const realQuote = Math.max(2, Math.ceil(scanUniverse().length / 30)) * MIN;
  const table = {
    quote: demo ? MIN : realQuote,
    intraday: demo ? MIN : 5 * MIN,
    daily: demo ? 10 * MIN : 12 * HOUR,
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

/**
 * Kurs für den Live-Stream. Bei wenigen Symbolen (Detailseite) wird mit 30 s
 * Cache aktiv nachgeladen; sonst nur gelesen, was der Snapshot bereits geholt
 * hat – so kann der Stream nie das Rate-Limit ausschöpfen.
 */
export async function liveQuote(instrument: Instrument, fresh: boolean): Promise<Quote | null> {
  const p = getProviders().price(instrument);
  if (fresh) {
    return (await cached(`quote-live:${p.id}:${instrument.symbol}`, () => p.getQuote(instrument), { ttl: 30_000, staleTtl: HOUR }))
      .value;
  }
  return peek<Quote>(`quote-live:${p.id}:${instrument.symbol}`) ?? peek<Quote>(`quote:${p.id}:${instrument.symbol}`) ?? null;
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

/**
 * Optionale Daten (Social, News): Fehler machen die Zeile nicht kaputt. Nur ein
 * echter Anbieterfehler gilt als „veraltet“ – ein verschobener Abruf
 * (Kontingent gerade erschöpft) nicht.
 */
function optional<T>(p: Promise<CacheResult<T>>, empty: T): Promise<CacheResult<T>> {
  return p.catch((e: unknown) => ({ value: empty, fetchedAt: 0, stale: !(e instanceof RateLimitError) }));
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

/**
 * Während einer laufenden Sitzung ist das Tagesvolumen unvollständig. Für den
 * Vergleich mit ganzen Tagen wird es anhand des Sitzungsfortschritts auf einen
 * vollen Tag hochgerechnet (linear, mindestens 15 % Fortschritt).
 */
export function projectOpenSessionVolume(volumes: readonly number[], instrument: Instrument, marketOpen: boolean, now = nowMs()): number[] {
  const out = [...volumes];
  if (!marketOpen || out.length === 0) return out;
  const s = latestSession(instrument.region, now);
  if (!s.isOpen) return out;
  const progress = Math.min(1, Math.max(0.15, (now - s.open) / (s.close - s.open)));
  out[out.length - 1] = out[out.length - 1]! / progress;
  return out;
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
    optional(loadSocial(instrument), EMPTY_SOCIAL),
    optional(loadNews(instrument), EMPTY_NEWS),
  ]);
  const closes = daily.value.map((c) => c.c);
  // Kursreihe mit aktuellem Kurs synchronisieren
  if (closes.length > 0 && Number.isFinite(quote.value.price)) closes[closes.length - 1] = quote.value.price;
  const inputs = signalInputs(daily.value, social.value, news.value);
  const signal = computeSignal({ ...inputs, volumes: projectOpenSessionVolume(inputs.volumes, instrument, quote.value.marketOpen) });
  const days = social.value.daily;
  const today = days[days.length - 1];
  const baselineDays = days.slice(-31, -1);
  const baseline = baselineDays.reduce((a, d) => a + d.mentions, 0) / Math.max(1, baselineDays.length);
  const mentions24h = today?.mentions ?? 0;
  const moveZ = dailyMoveZ(closes);

  const row: InstrumentRow = {
    symbol: instrument.symbol,
    ticker: instrument.ticker,
    name: instrument.name,
    sector: instrument.sector,
    region: instrument.region,
    exchange: instrument.exchange,
    currency: instrument.currency,
    size: instrument.size,
    index: instrument.index,
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
    moveZ: round(moveZ, 2),
    relevant: isRelevant({ score: signal.score, moveZ }),
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

/** Indexzeilen (eigener Cache, auch für den Live-Stream). */
export async function getIndexRows(): Promise<IndexRow[]> {
  return (await cached("indices", buildIndices, ttl("intraday"))).value;
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

/* ------------------------------------------------------------------ */
/* Hintergrund-Lader (nur echte Provider)                              */
/* ------------------------------------------------------------------ */

/**
 * Die Übersicht nimmt nur, was die Kontingente sofort hergeben (Budget 0).
 * Fehlende Werte lädt dieser Lader nach und nach im Rahmen der Limits nach –
 * einer nach dem anderen, damit Detailseiten und Live-Abfragen Vorrang behalten.
 */
const warmer = globalThis as { __signalWarmer?: { running: boolean; timer: ReturnType<typeof setInterval> } };

function hasCachedRow(instrument: Instrument): boolean {
  const ps = getProviders();
  const p = ps.price(instrument);
  const news = ps.news(instrument);
  const social = ps.social(instrument);
  return (
    peek(`daily:${p.id}:${instrument.symbol}:${SCORING_DAYS}`) !== undefined &&
    peek(`quote:${p.id}:${instrument.symbol}`) !== undefined &&
    (news.mock || peek(`news:${news.id}:${instrument.symbol}`) !== undefined) &&
    (social.mock || peek(`social:${social.id}:${instrument.symbol}`) !== undefined)
  );
}

export function missingRows(): Instrument[] {
  const ps = getProviders();
  return scanUniverse().filter((i) => !ps.price(i).mock && !hasCachedRow(i));
}

async function warmStep(): Promise<void> {
  const state = warmer.__signalWarmer;
  if (!state || state.running) return;
  state.running = true;
  const started = Date.now();
  try {
    for (const instrument of missingRows()) {
      if (Date.now() - started > 50_000) break;
      await withLimiterBudget(20_000, () => buildRow(instrument)).catch(() => undefined);
    }
  } finally {
    state.running = false;
  }
}

function ensureWarmer(): void {
  if (getProviders().demo || warmer.__signalWarmer || missingRows().length === 0) return;
  const timer = setInterval(() => void warmStep(), 60_000);
  timer.unref?.();
  warmer.__signalWarmer = { running: false, timer };
  void warmStep();
}

async function buildSnapshot(): Promise<Snapshot> {
  assertScenario();
  const ps = getProviders();
  const scan = scanUniverse();
  // Echte Provider: nicht auf Kontingente warten (Budget 0) – Fehlendes lädt der Hintergrund-Lader
  const results = await mapLimit(scan, 12, (i) => (ps.demo ? buildRow(i) : withLimiterBudget(0, () => buildRow(i))));
  const bundles = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const failed = results.length - bundles.length;
  if (bundles.length === 0) {
    const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw first?.reason instanceof Error ? first.reason : new Error("Keine Daten verfügbar");
  }
  const indices = await getIndexRows().catch(() => [] as IndexRow[]);
  const now = nowMs();
  const notes: string[] = [];
  if (failed > 0) {
    ensureWarmer();
    notes.push(
      ps.demo
        ? `${failed} von ${scan.length} Werten konnten nicht geladen werden.`
        : `${bundles.length} von ${scan.length} Werten geladen – die übrigen werden im Hintergrund im Rahmen der Anbieter-Kontingente nachgeladen.`,
    );
  }
  const scenarioStale = ps.demo && mockScenario() === "stale";
  const asOf = scenarioStale ? now - 3 * HOUR : Math.max(...bundles.map((b) => b.quoteTime));

  const status: DataStatus = {
    asOf,
    generatedAt: now,
    stale: scenarioStale || bundles.some((b) => b.stale),
    demo: ps.demo,
    marketOpen: marketOpenMap(now),
    sources: ps.active.map(({ id, label, mock, attribution }) => ({ id, label, mock, attribution })),
    coverage: { loaded: bundles.length, total: scan.length, universe: UNIVERSE.length },
    notes,
  };
  return { status, rows: bundles.map((b) => b.row), indices };
}

export async function getSnapshot(): Promise<Snapshot> {
  // Solange noch Werte fehlen (Hintergrund-Lader holt sie nach), die Übersicht öfter neu zusammensetzen
  const base = ttl("snapshot");
  const res = await cached("snapshot", buildSnapshot, {
    ttl: (snap: Snapshot) => (snap.status.coverage.loaded < snap.status.coverage.total ? Math.min(base.ttl, 30_000) : base.ttl),
    staleTtl: base.staleTtl,
  });
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
    const points = candles.map((c) => ({ t: c.t, v: round(c.c) }));
    // Letzter Punkt = aktueller Kurs (Kerzen können dem Kurs hinterherhinken)
    const lastPoint = points[points.length - 1];
    if (lastPoint && quote.marketOpen && Number.isFinite(quote.price)) lastPoint.v = round(quote.price);
    return {
      range,
      points,
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

  // Bei offener Börse startet der Chart mit „Heute“ (Live-Ticks sichtbar), sonst mit 1 Monat.
  const open = latestSession(instrument.region, now).isOpen;
  const [bundle, fundamentals, social, news, chart] = await Promise.all([
    buildRow(instrument),
    loadFundamentals(instrument),
    optional(loadSocial(instrument), EMPTY_SOCIAL),
    optional(loadNews(instrument), EMPTY_NEWS),
    buildChart(instrument, open ? "1D" : "1M")
      .then((c) => (c.points.length > 1 ? c : buildChart(instrument, "1M")))
      .catch(() => buildChart(instrument, "1M")),
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
    // „Demo“ nur, wenn alle Quellen simuliert sind – sonst zeigt die Statuszeile „Teils Demo“
    demo: ps.price(instrument).mock && ps.social(instrument).mock && ps.news(instrument).mock,
    marketOpen: marketOpenMap(now),
    sources: [
      ps.price(instrument),
      ps.social(instrument),
      ps.news(instrument),
      ps.analyzer,
    ].map(({ id, label, mock, attribution }) => ({ id, label, mock, attribution })),
    coverage: { loaded: 1, total: 1, universe: UNIVERSE.length },
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
    demoParts: {
      price: ps.price(instrument).mock,
      social: ps.social(instrument).mock,
      news: ps.news(instrument).mock,
    },
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

/**
 * Zeilen für eine Symbolliste (Watchlist): aus dem Snapshot, nicht gescannte
 * Werte werden einzeln nachgeladen.
 */
export async function getRows(symbols: readonly string[]): Promise<{ rows: InstrumentRow[]; status: DataStatus }> {
  const snapshot = await getSnapshot();
  const bySymbol = new Map(snapshot.rows.map((r) => [r.symbol, r]));
  const instruments = symbols.map((s) => getInstrument(s)).filter((i): i is Instrument => Boolean(i));
  const missing = instruments.filter((i) => !bySymbol.has(i.symbol));
  const extra = await mapLimit(missing, 4, (i) => cached(`row:${i.symbol}`, () => buildRow(i), ttl("snapshot")));
  for (const r of extra) if (r.status === "fulfilled") bySymbol.set(r.value.value.row.symbol, r.value.value.row);
  const rows = instruments.map((i) => bySymbol.get(i.symbol)).filter((r): r is InstrumentRow => r !== undefined);
  return { rows, status: snapshot.status };
}

export function allSymbols(): string[] {
  return UNIVERSE.map((i) => i.symbol);
}

export function providersAreDemo(): boolean {
  return getProviders().demo;
}
