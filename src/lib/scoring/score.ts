import {
  COMPONENT_KEYS,
  COMPONENT_META,
  COMPONENT_TO_TYPE,
  SIGNAL_CONFIG,
  type ComponentKey,
  type SignalConfig,
  type SignalType,
} from "@/config/signals";
import { formatNumber, formatPercent } from "@/lib/format";
import { clamp, clamp01, mean, returns, stdev, sum, tail, weightedMean } from "./stats";
import type { Confidence, Direction, ScoreComponent, Signal, SignalDirection, SignalInputs } from "./types";

type RawComponent = Omit<ScoreComponent, "weight" | "points" | "label">;

const dirOf = (value: number, deadband = 0): Direction => (value > deadband ? 1 : value < -deadband ? -1 : 0);

function unavailable(key: ComponentKey, detail: string): RawComponent {
  return { key, score: 0, direction: 0, available: false, metrics: {}, detail, short: "keine Daten" };
}

/** Normierte Gewichte (Summe 1). Negative Gewichte werden als 0 behandelt. */
export function normalizeWeights(weights: Record<ComponentKey, number>): Record<ComponentKey, number> {
  const total = COMPONENT_KEYS.reduce((acc, k) => acc + Math.max(0, weights[k]), 0);
  const out = {} as Record<ComponentKey, number>;
  for (const k of COMPONENT_KEYS) out[k] = total > 0 ? Math.max(0, weights[k]) / total : 1 / COMPONENT_KEYS.length;
  return out;
}

/* ------------------------------------------------------------------ */
/* Einzelkomponenten                                                   */
/* ------------------------------------------------------------------ */

export function scoreMentions(inputs: SignalInputs, cfg: SignalConfig = SIGNAL_CONFIG): RawComponent {
  const series = inputs.mentionsDaily;
  if (series.length < 8) return unavailable("mentions", "Zu wenig Verlauf für eine Basislinie.");
  const today = series[series.length - 1] ?? 0;
  const baseline = tail(series.slice(0, -1), cfg.windows.mentionBaselineDays);
  const m = mean(baseline);
  // Untergrenzen: Poisson-Streuung √μ, Mindest-Variationskoeffizient und 1 –
  // verhindern Ausreißer bei ruhigen Reihen.
  const s = Math.max(stdev(baseline), Math.sqrt(Math.max(m, 0)), cfg.caps.mentionsMinCv * m, 1);
  const z = (today - m) / s;
  const ratio = today / Math.max(m, 1);
  let score = clamp01(z / cfg.caps.mentionsZ) * 100;
  const thin = m < cfg.thresholds.minBaselineMentions && today < cfg.thresholds.minBaselineMentions * 4;
  if (thin) score = Math.min(score, cfg.thresholds.thinDataMentionCap);

  const detail =
    z >= 1
      ? `${formatNumber(ratio, 1)}× so viele Erwähnungen wie im 30-Tage-Schnitt (${formatNumber(today, 0)} statt Ø ${formatNumber(m, 0)}, z = ${formatNumber(z, 1)}).`
      : z <= -1
        ? `Weniger Erwähnungen als üblich (${formatNumber(today, 0)} statt Ø ${formatNumber(m, 0)}).`
        : `Erwähnungen im üblichen Rahmen (${formatNumber(today, 0)}, Ø ${formatNumber(m, 0)}).`;

  return {
    key: "mentions",
    score,
    direction: 0,
    available: true,
    metrics: { today, baselineMean: m, baselineStd: s, z, ratio, thin: thin ? 1 : 0 },
    detail,
    short:
      z >= 1
        ? `${formatNumber(ratio, 1)}× mehr Erwähnungen als üblich`
        : z <= -1
          ? "Weniger Erwähnungen als üblich"
          : "Erwähnungen im üblichen Rahmen",
  };
}

function sentimentToday(inputs: SignalInputs, cfg: SignalConfig): { value: number; baseline: number } {
  const s = inputs.sentimentDaily;
  const m = inputs.mentionsDaily;
  const value = s[s.length - 1] ?? null;
  const days = cfg.windows.sentimentBaselineDays;
  const prevS = tail(s.slice(0, -1), days);
  const prevM = tail(m.slice(0, -1), days);
  // Gewichtung mit Erwähnungen, damit ruhige Tage die Basislinie nicht verzerren.
  const baseline = weightedMean(prevS, prevM.length === prevS.length ? prevM.map((x) => Math.max(x, 1)) : prevS.map(() => 1));
  return { value: value === null ? NaN : value, baseline };
}

function toneWord(value: number): string {
  const a = Math.abs(value);
  const tone = value > 0 ? "positiv" : "negativ";
  if (a >= 0.45) return `sehr ${tone}`;
  if (a >= 0.25) return `deutlich ${tone}`;
  if (a >= 0.1) return `leicht ${tone}`;
  return "ausgeglichen";
}

export function scoreSentimentLevel(inputs: SignalInputs, cfg: SignalConfig = SIGNAL_CONFIG): RawComponent {
  const { value } = sentimentToday(inputs, cfg);
  if (!Number.isFinite(value)) return unavailable("sentimentLevel", "Keine Stimmungsdaten für heute.");
  const v = clamp(value, -1, 1);
  const score = clamp01(Math.abs(v) / cfg.caps.sentimentLevel) * 100;
  return {
    key: "sentimentLevel",
    score,
    direction: dirOf(v, 0.1),
    available: true,
    metrics: { sentiment: v },
    detail: `Stimmung in Diskussionen ${toneWord(v)} (${formatNumber(v, 2, { sign: true })} auf einer Skala von −1 bis +1).`,
    short: `Stimmung ${toneWord(v)} (${formatNumber(v, 2, { sign: true })})`,
  };
}

export function scoreSentimentShift(inputs: SignalInputs, cfg: SignalConfig = SIGNAL_CONFIG): RawComponent {
  const { value, baseline } = sentimentToday(inputs, cfg);
  if (!Number.isFinite(value) || !Number.isFinite(baseline))
    return unavailable("sentimentShift", "Zu wenig Stimmungsverlauf für einen Vergleich.");
  const delta = clamp(value, -1, 1) - clamp(baseline, -1, 1);
  const score = clamp01(Math.abs(delta) / cfg.caps.sentimentShift) * 100;
  const verb = delta > 0.05 ? "aufgehellt" : delta < -0.05 ? "eingetrübt" : "kaum verändert";
  return {
    key: "sentimentShift",
    score,
    direction: dirOf(delta, 0.05),
    available: true,
    metrics: { sentiment: value, baseline, delta },
    detail:
      verb === "kaum verändert"
        ? `Stimmung gegenüber der Vorwoche kaum verändert (${formatNumber(delta, 2, { sign: true })}).`
        : `Stimmung hat sich gegenüber der Vorwoche ${verb} (${formatNumber(baseline, 2, { sign: true })} → ${formatNumber(value, 2, { sign: true })}).`,
    short:
      verb === "kaum verändert"
        ? "Stimmung stabil ggü. Vorwoche"
        : `Stimmung ${verb} (${formatNumber(delta, 2, { sign: true })})`,
  };
}

export function scoreMomentum(inputs: SignalInputs, cfg: SignalConfig = SIGNAL_CONFIG): RawComponent {
  const closes = inputs.closes;
  const n = cfg.windows.momentumDays;
  if (closes.length < n + 2) return unavailable("momentum", "Zu wenig Kurshistorie.");
  const last = closes[closes.length - 1] ?? NaN;
  const ref = closes[closes.length - 1 - n] ?? NaN;
  const r = last / ref - 1;
  const vol = stdev(tail(returns(closes), cfg.windows.volatilityDays));
  const expected = Math.max(vol, 0.002) * Math.sqrt(n);
  const z = r / expected;
  const score = clamp01(Math.abs(z) / cfg.caps.momentumZ) * 100;
  const size = Math.abs(z) >= 2 ? "ungewöhnlich stark" : Math.abs(z) >= 1 ? "spürbar" : "im Rahmen";
  return {
    key: "momentum",
    score,
    direction: dirOf(z, 0.5),
    available: true,
    metrics: { return20d: r, volatility: vol, z },
    detail: `Kurs ${formatPercent(r * 100, 1)} in ${n} Handelstagen – ${size} gemessen an der üblichen Schwankung (${formatNumber(z, 1, { sign: true })} σ).`,
    short: `Kurs ${formatPercent(r * 100, 1)} in ${n} Handelstagen`,
  };
}

export function scoreVolume(inputs: SignalInputs, cfg: SignalConfig = SIGNAL_CONFIG): RawComponent {
  const v = inputs.volumes;
  if (v.length < 6) return unavailable("volume", "Zu wenig Volumendaten.");
  const today = v[v.length - 1] ?? NaN;
  const base = mean(tail(v.slice(0, -1), cfg.windows.volumeBaselineDays).filter((x) => x > 0));
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(today)) return unavailable("volume", "Kein Volumen verfügbar.");
  const ratio = today / base;
  const score = clamp01((ratio - 1) / cfg.caps.volumeExcess) * 100;
  return {
    key: "volume",
    score,
    direction: 0,
    available: true,
    metrics: { today, baselineMean: base, ratio },
    detail:
      ratio >= 1.2
        ? `Handelsvolumen ${formatNumber(ratio, 1)}× so hoch wie im 20-Tage-Schnitt.`
        : ratio <= 0.8
          ? `Handelsvolumen unter dem Durchschnitt (${formatNumber(ratio, 1)}×).`
          : `Handelsvolumen im üblichen Rahmen (${formatNumber(ratio, 1)}×).`,
    short: ratio >= 1.2 ? `Volumen ${formatNumber(ratio, 1)}× über Schnitt` : `Volumen ${formatNumber(ratio, 1)}× Schnitt`,
  };
}

export function scoreNews(inputs: SignalInputs, cfg: SignalConfig = SIGNAL_CONFIG): RawComponent {
  const d = inputs.newsDaily;
  const k = cfg.windows.newsRecentDays;
  if (d.length < k + 5) return unavailable("news", "Zu wenig Nachrichtenverlauf.");
  const recent = sum(tail(d, k));
  const baselineDaily = mean(tail(d.slice(0, -k), cfg.windows.newsBaselineDays));
  const lambda = Math.max(baselineDaily * k, 0);
  const z = (recent - lambda) / Math.sqrt(Math.max(lambda, 1));
  const score = clamp01(z / cfg.caps.newsZ) * 100;
  return {
    key: "news",
    score,
    direction: 0,
    available: true,
    metrics: { recent, expected: lambda, z },
    detail:
      z >= 1
        ? `${formatNumber(recent, 0)} Nachrichten in 48 Std. – üblich sind etwa ${formatNumber(lambda, 0)}.`
        : `${formatNumber(recent, 0)} Nachrichten in 48 Std. (üblich: ~${formatNumber(lambda, 0)}).`,
    short: `${formatNumber(recent, 0)} News in 48 Std. (sonst ~${formatNumber(lambda, 0)})`,
  };
}

const SCORERS: Record<ComponentKey, (inputs: SignalInputs, cfg: SignalConfig) => RawComponent> = {
  mentions: scoreMentions,
  sentimentLevel: scoreSentimentLevel,
  sentimentShift: scoreSentimentShift,
  momentum: scoreMomentum,
  volume: scoreVolume,
  news: scoreNews,
};

/* ------------------------------------------------------------------ */
/* Gesamtscore                                                         */
/* ------------------------------------------------------------------ */

function computeBias(byKey: Record<ComponentKey, ScoreComponent>, cfg: SignalConfig): number {
  const s = byKey.sentimentLevel.available ? (byKey.sentimentLevel.metrics.sentiment ?? 0) : 0;
  const d = byKey.sentimentShift.available ? (byKey.sentimentShift.metrics.delta ?? 0) : 0;
  const z = byKey.momentum.available ? (byKey.momentum.metrics.z ?? 0) : 0;
  const bias =
    cfg.bias.sentimentLevel * clamp(s / cfg.caps.sentimentLevel, -1, 1) +
    cfg.bias.sentimentShift * clamp(d / cfg.caps.sentimentShift, -1, 1) +
    cfg.bias.momentum * Math.tanh(z / 1.5);
  return clamp(bias, -1, 1);
}

function directionOf(bias: number, cfg: SignalConfig): SignalDirection {
  if (bias >= cfg.thresholds.directionBias) return "bullish";
  if (bias <= -cfg.thresholds.directionBias) return "bearish";
  return "neutral";
}

function confidenceOf(byKey: Record<ComponentKey, ScoreComponent>, cfg: SignalConfig): Confidence {
  const missing = COMPONENT_KEYS.filter((k) => !byKey[k].available).length;
  const base = byKey.mentions.metrics.baselineMean ?? 0;
  if (missing >= 2 || !byKey.mentions.available || base < cfg.thresholds.minBaselineMentions) return "niedrig";
  if (missing === 0 && base >= cfg.thresholds.solidBaselineMentions) return "hoch";
  return "mittel";
}

const DIRECTION_PHRASE: Record<SignalDirection, string> = {
  bullish: "positiver Tendenz",
  bearish: "negativer Tendenz",
  neutral: "gemischter Tendenz",
};

const TYPE_HEADLINE: Record<SignalType, string> = {
  buzz: "Buzz-Ausbruch",
  sentiment: "Stimmungswandel",
  momentum: "Kursmomentum",
  volume: "Volumen-Anomalie",
  news: "Nachrichtenwelle",
};

/**
 * Signaltyp = der ungewöhnlichste Faktor (höchster Teilscore). Die beiden
 * Stimmungs-Komponenten zählen gemeinsam als „Stimmungswandel“. Bei (nahezu)
 * gleichem Teilscore entscheidet der größere Beitrag zum Gesamtscore.
 */
export function dominantType(components: ScoreComponent[]): SignalType {
  const byType = new Map<SignalType, { score: number; points: number }>();
  for (const c of components) {
    if (!c.available) continue;
    const t = COMPONENT_TO_TYPE[c.key];
    const prev = byType.get(t) ?? { score: 0, points: 0 };
    byType.set(t, { score: Math.max(prev.score, c.score), points: prev.points + c.points });
  }
  let type: SignalType = "buzz";
  let best = { score: -1, points: -1 };
  for (const [t, v] of byType) {
    const clearlyHigher = v.score > best.score + 2;
    const tieButBigger = Math.abs(v.score - best.score) <= 2 && v.points > best.points;
    if (clearlyHigher || tieButBigger) {
      best = v;
      type = t;
    }
  }
  return type;
}

export function computeSignal(inputs: SignalInputs, cfg: SignalConfig = SIGNAL_CONFIG): Signal {
  const raws = COMPONENT_KEYS.map((key) => SCORERS[key](inputs, cfg));
  // Gewichte nur über verfügbare Komponenten normieren: Fehlt eine Datenquelle,
  // verteilt sich ihr Gewicht anteilig auf die übrigen (Hinweis in `caveats`).
  const baseWeights = normalizeWeights(cfg.weights);
  const availableWeight = raws.reduce((acc, r) => acc + (r.available ? baseWeights[r.key] : 0), 0);
  const components: ScoreComponent[] = raws.map((raw) => {
    const score = raw.available && Number.isFinite(raw.score) ? clamp(raw.score, 0, 100) : 0;
    const weight = raw.available && availableWeight > 0 ? baseWeights[raw.key] / availableWeight : 0;
    return { ...raw, score, label: COMPONENT_META[raw.key].label, weight, points: weight * score };
  });
  const byKey = Object.fromEntries(components.map((c) => [c.key, c])) as Record<ComponentKey, ScoreComponent>;

  const total = clamp(Math.round(components.reduce((acc, c) => acc + c.points, 0)), 0, 100);

  const type = dominantType(components);

  const bias = computeBias(byKey, cfg);
  const direction = directionOf(bias, cfg);
  const confidence = confidenceOf(byKey, cfg);

  // Begründungen: zuerst der Faktor, der den Signaltyp bestimmt, dann nach Beitrag.
  const ranked = [...components]
    .filter((c) => c.available)
    .sort((a, b) => {
      const ta = COMPONENT_TO_TYPE[a.key] === type ? 1 : 0;
      const tb = COMPONENT_TO_TYPE[b.key] === type ? 1 : 0;
      if (ta !== tb) return tb - ta;
      return ta === 1 ? b.score - a.score : b.points - a.points;
    });
  let reasonComps = ranked.filter((c) => c.score >= cfg.thresholds.reasonMinScore);
  if (reasonComps.length === 0) reasonComps = ranked.slice(0, 2);
  const reasons = reasonComps.map((c) => c.detail);
  const highlights = reasonComps.map((c) => c.short);

  const caveats: string[] = [];
  if (byKey.mentions.metrics.thin === 1)
    caveats.push("Wenige Erwähnungen – schon kleine Ausschläge wirken groß. Buzz-Anteil wurde gedeckelt.");
  const missing = components.filter((c) => !c.available);
  if (missing.length > 0)
    caveats.push(
      `Ohne Daten: ${missing.map((c) => c.label).join(", ")}. Das Gewicht wurde auf die übrigen Faktoren verteilt.`,
    );

  const headline = `${TYPE_HEADLINE[type]} mit ${DIRECTION_PHRASE[direction]}`;

  return {
    score: total,
    components,
    type,
    direction,
    bias,
    confidence,
    flagged: total >= cfg.thresholds.flagged,
    headline,
    reasons,
    highlights,
    caveats,
  };
}
