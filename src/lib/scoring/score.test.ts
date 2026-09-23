import { describe, expect, it } from "vitest";
import { COMPONENT_KEYS, SIGNAL_CONFIG, type SignalConfig } from "@/config/signals";
import {
  computeSignal,
  normalizeWeights,
  scoreMentions,
  scoreMomentum,
  scoreNews,
  scoreSentimentLevel,
  scoreSentimentShift,
  scoreVolume,
} from "./score";
import { mean, stdev, zScore, returns, weightedMean, clamp } from "./stats";
import type { SignalInputs } from "./types";

/** Ruhige Basis: konstante Erwähnungen, neutrale Stimmung, flacher Kurs. */
function baseInputs(overrides: Partial<SignalInputs> = {}): SignalInputs {
  const days = 40;
  const mentions = Array.from({ length: days }, (_, i) => 100 + ((i * 7) % 11) - 5);
  const closes = Array.from({ length: 90 }, (_, i) => 100 * (1 + 0.004 * Math.sin(i)));
  return {
    mentionsDaily: mentions,
    sentimentDaily: mentions.map(() => 0.02),
    closes,
    volumes: closes.map((_, i) => 1_000_000 + ((i * 13) % 7) * 10_000),
    newsDaily: Array.from({ length: 40 }, () => 3),
    ...overrides,
  };
}

function withLast<T>(series: readonly T[], value: T): T[] {
  return [...series.slice(0, -1), value];
}

describe("stats", () => {
  it("berechnet Mittelwert und Stichproben-σ", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(stdev([5])).toBe(0);
    expect(mean([])).toBeNaN();
  });

  it("ignoriert nicht-endliche Werte", () => {
    expect(mean([1, NaN, 3, Infinity])).toBe(2);
  });

  it("z-Score respektiert Untergrenze der Streuung", () => {
    expect(zScore(12, [10, 10, 10, 10], 1)).toBe(2);
    expect(zScore(10, [10, 10, 10])).toBe(0);
    expect(zScore(11, [10, 10, 10])).toBe(Infinity);
  });

  it("berechnet Renditen und gewichtete Mittel", () => {
    expect(returns([100, 110, 99])).toEqual([0.10000000000000009, -0.09999999999999998]);
    expect(weightedMean([1, null, 3], [1, 5, 3])).toBe(2.5);
    expect(weightedMean([null], [1])).toBeNaN();
    expect(clamp(NaN, 0, 1)).toBe(0);
  });
});

describe("Gewichte", () => {
  it("Standardgewichte summieren sich zu 1", () => {
    const total = COMPONENT_KEYS.reduce((a, k) => a + SIGNAL_CONFIG.weights[k], 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("normiert beliebige Gewichte auf Summe 1", () => {
    const w = normalizeWeights({ mentions: 3, sentimentLevel: 1, sentimentShift: 0, momentum: 1, volume: 0, news: -2 });
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(w.mentions).toBeCloseTo(0.6);
    expect(w.news).toBe(0);
  });

  it("fällt bei Nullgewichten auf Gleichverteilung zurück", () => {
    const w = normalizeWeights({ mentions: 0, sentimentLevel: 0, sentimentShift: 0, momentum: 0, volume: 0, news: 0 });
    expect(w.mentions).toBeCloseTo(1 / 6);
  });
});

describe("Erwähnungs-Spike", () => {
  it("ruhige Reihe ergibt ~0 Punkte", () => {
    const c = scoreMentions(baseInputs());
    expect(c.available).toBe(true);
    expect(c.score).toBeLessThanOrEqual(15);
  });

  it("starker Ausschlag ergibt hohe Punktzahl und Erklärung mit Faktor", () => {
    const base = baseInputs();
    const c = scoreMentions({ ...base, mentionsDaily: withLast(base.mentionsDaily, 400) });
    expect(c.metrics.z).toBeGreaterThan(SIGNAL_CONFIG.caps.mentionsZ);
    expect(c.score).toBe(100);
    expect(c.detail).toMatch(/so viele Erwähnungen/);
    expect(c.metrics.ratio).toBeCloseTo(4, 0);
    expect(c.metrics.baselineStd).toBeCloseTo(25, 0);
  });

  it("z-Score ist linear bis zur Kappung", () => {
    const flat = Array.from({ length: 31 }, () => 100);
    // σ = 0 → Untergrenze max(√100, 0,25·100) = 25; heute 150 → z = 2 → 50 Punkte bei Kappung 4
    const c = scoreMentions({ ...baseInputs(), mentionsDaily: withLast(flat, 150) });
    expect(c.metrics.z).toBeCloseTo(2);
    expect(c.score).toBeCloseTo(50);
  });

  it("deckelt Buzz bei dünner Datenbasis", () => {
    const thin = Array.from({ length: 31 }, () => 1);
    const c = scoreMentions({ ...baseInputs(), mentionsDaily: withLast(thin, 15) });
    expect(c.metrics.thin).toBe(1);
    expect(c.score).toBeLessThanOrEqual(SIGNAL_CONFIG.thresholds.thinDataMentionCap);
  });

  it("zu kurze Reihe ist nicht verfügbar", () => {
    const c = scoreMentions({ ...baseInputs(), mentionsDaily: [1, 2, 3] });
    expect(c.available).toBe(false);
    expect(c.score).toBe(0);
  });

  it("weniger Erwähnungen als üblich geben 0 Punkte", () => {
    const base = baseInputs();
    const c = scoreMentions({ ...base, mentionsDaily: withLast(base.mentionsDaily, 10) });
    expect(c.score).toBe(0);
    expect(c.detail).toMatch(/Weniger Erwähnungen/);
  });
});

describe("Stimmung", () => {
  it("Niveau skaliert mit |Stimmung| und kennt die Richtung", () => {
    const base = baseInputs();
    const pos = scoreSentimentLevel({ ...base, sentimentDaily: withLast(base.sentimentDaily, 0.25) });
    expect(pos.score).toBeCloseTo(50);
    expect(pos.direction).toBe(1);
    const neg = scoreSentimentLevel({ ...base, sentimentDaily: withLast(base.sentimentDaily, -0.9) });
    expect(neg.score).toBe(100);
    expect(neg.direction).toBe(-1);
    expect(neg.detail).toMatch(/sehr negativ/);
  });

  it("fehlende Stimmung heute ist nicht verfügbar", () => {
    const base = baseInputs();
    const c = scoreSentimentLevel({ ...base, sentimentDaily: withLast(base.sentimentDaily, null) });
    expect(c.available).toBe(false);
  });

  it("Wechsel misst Abweichung zur Vorwoche", () => {
    const base = baseInputs();
    const c = scoreSentimentShift({ ...base, sentimentDaily: withLast(base.sentimentDaily, 0.37) });
    expect(c.metrics.delta).toBeCloseTo(0.35);
    expect(c.score).toBeCloseTo(100);
    expect(c.detail).toMatch(/aufgehellt/);
  });

  it("Wechsel ist ohne Vorwochen-Daten nicht verfügbar", () => {
    const base = baseInputs();
    const c = scoreSentimentShift({ ...base, sentimentDaily: base.sentimentDaily.map((_, i, a) => (i === a.length - 1 ? 0.3 : null)) });
    expect(c.available).toBe(false);
  });
});

describe("Momentum", () => {
  it("flacher Kurs ergibt wenig Punkte", () => {
    expect(scoreMomentum(baseInputs()).score).toBeLessThan(30);
  });

  it("starker Anstieg relativ zur Volatilität ergibt hohe Punkte und positive Richtung", () => {
    const base = baseInputs();
    const closes = [...base.closes.slice(0, -20), ...Array.from({ length: 20 }, (_, i) => 100 * (1 + 0.01 * (i + 1)))];
    const c = scoreMomentum({ ...base, closes });
    expect(c.metrics.return20d).toBeGreaterThan(0.15);
    expect(c.score).toBe(100);
    expect(c.direction).toBe(1);
  });

  it("zu kurze Historie ist nicht verfügbar", () => {
    expect(scoreMomentum({ ...baseInputs(), closes: [1, 2, 3] }).available).toBe(false);
  });
});

describe("Volumen", () => {
  it("3× Volumen erreicht die Kappung", () => {
    const base = baseInputs();
    const avg = mean(base.volumes.slice(-21, -1));
    const c = scoreVolume({ ...base, volumes: withLast(base.volumes, avg * 3) });
    expect(c.metrics.ratio).toBeCloseTo(3);
    expect(c.score).toBeCloseTo(100);
  });

  it("unterdurchschnittliches Volumen gibt 0 Punkte", () => {
    const base = baseInputs();
    expect(scoreVolume({ ...base, volumes: withLast(base.volumes, 100) }).score).toBe(0);
  });

  it("ohne Volumen nicht verfügbar", () => {
    expect(scoreVolume({ ...baseInputs(), volumes: [0, 0, 0, 0, 0, 0, 0] }).available).toBe(false);
  });
});

describe("Nachrichten", () => {
  it("Poisson-z-Score über 48 Std.", () => {
    const base = baseInputs();
    // Basis 3/Tag → λ = 6 in 48 Std.; 6 + 3·√6 ≈ 13,35 → z = 3
    const news = [...base.newsDaily.slice(0, -2), 7, 6.35];
    const c = scoreNews({ ...base, newsDaily: news });
    expect(c.metrics.expected).toBeCloseTo(6);
    expect(c.metrics.z).toBeCloseTo(3, 1);
    expect(c.score).toBeCloseTo(100, 0);
  });

  it("übliche Lage gibt 0 Punkte", () => {
    expect(scoreNews(baseInputs()).score).toBe(0);
  });
});

describe("Gesamtsignal", () => {
  it("ruhiger Wert ist nicht markiert, neutral", () => {
    const s = computeSignal(baseInputs());
    expect(s.score).toBeLessThan(SIGNAL_CONFIG.thresholds.flagged);
    expect(s.flagged).toBe(false);
    expect(s.direction).toBe("neutral");
    expect(s.components).toHaveLength(6);
    expect(s.reasons.length).toBeGreaterThan(0);
  });

  it("Score ist die gewichtete Summe der Teilscores", () => {
    const base = baseInputs();
    const s = computeSignal({
      ...base,
      mentionsDaily: withLast(base.mentionsDaily, 500),
      sentimentDaily: withLast(base.sentimentDaily, 0.6),
    });
    const expected = s.components.reduce((a, c) => a + c.weight * c.score, 0);
    expect(s.score).toBe(Math.round(expected));
    s.components.forEach((c) => expect(c.points).toBeCloseTo(c.weight * c.score));
  });

  it("Buzz + positive Stimmung → markiertes Buzz-Signal mit positiver Richtung", () => {
    const base = baseInputs();
    const avgVol = mean(base.volumes.slice(-21, -1));
    const s = computeSignal({
      ...base,
      mentionsDaily: withLast(base.mentionsDaily, 600),
      sentimentDaily: withLast(base.sentimentDaily, 0.55),
      volumes: withLast(base.volumes, avgVol * 2.6),
      newsDaily: [...base.newsDaily.slice(0, -2), 9, 9],
    });
    expect(s.flagged).toBe(true);
    expect(s.type).toBe("buzz");
    expect(s.direction).toBe("bullish");
    expect(s.headline).toBe("Buzz-Ausbruch mit positiver Tendenz");
    expect(s.reasons[0]).toMatch(/Erwähnungen/);
    expect(s.confidence).toBe("hoch");
  });

  it("negative Stimmung + Kursrutsch → negative Richtung", () => {
    const base = baseInputs();
    const closes = [...base.closes.slice(0, -20), ...Array.from({ length: 20 }, (_, i) => 100 * (1 - 0.012 * (i + 1)))];
    const s = computeSignal({ ...base, closes, sentimentDaily: withLast(base.sentimentDaily, -0.5) });
    expect(s.direction).toBe("bearish");
    expect(s.bias).toBeLessThan(0);
  });

  it("Typ folgt dem ungewöhnlichsten Faktor, nicht dem Gewicht", () => {
    const base = baseInputs();
    const avgVol = mean(base.volumes.slice(-21, -1));
    const s = computeSignal({
      ...base,
      mentionsDaily: withLast(base.mentionsDaily, 150),
      volumes: withLast(base.volumes, avgVol * 3.2),
    });
    expect(s.type).toBe("volume");
    const news = computeSignal({ ...base, newsDaily: [...base.newsDaily.slice(0, -2), 12, 12] });
    expect(news.type).toBe("news");
  });

  it("ist deterministisch", () => {
    expect(computeSignal(baseInputs())).toEqual(computeSignal(baseInputs()));
  });

  it("verarbeitet leere Eingaben ohne Fehler", () => {
    const s = computeSignal({ mentionsDaily: [], sentimentDaily: [], closes: [], volumes: [], newsDaily: [] });
    expect(s.score).toBe(0);
    expect(s.confidence).toBe("niedrig");
    expect(s.caveats.join(" ")).toMatch(/Ohne Daten/);
    expect(Number.isFinite(s.bias)).toBe(true);
  });

  it("verteilt Gewichte fehlender Komponenten auf die übrigen", () => {
    const base = baseInputs();
    const s = computeSignal({ ...base, sentimentDaily: base.sentimentDaily.map(() => null) });
    const missing = s.components.filter((c) => !c.available);
    expect(missing.map((c) => c.key).sort()).toEqual(["sentimentLevel", "sentimentShift"]);
    missing.forEach((c) => expect(c.weight).toBe(0));
    expect(s.components.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1, 10);
    expect(s.caveats.join(" ")).toMatch(/verteilt/);
  });

  it("respektiert eine eigene Konfiguration", () => {
    const base = baseInputs();
    const inputs = { ...base, mentionsDaily: withLast(base.mentionsDaily, 600) };
    const onlyBuzz: SignalConfig = {
      ...SIGNAL_CONFIG,
      weights: { mentions: 1, sentimentLevel: 0, sentimentShift: 0, momentum: 0, volume: 0, news: 0 },
    };
    expect(computeSignal(inputs, onlyBuzz).score).toBe(100);
    const noBuzz: SignalConfig = {
      ...SIGNAL_CONFIG,
      weights: { mentions: 0, sentimentLevel: 1, sentimentShift: 0, momentum: 0, volume: 0, news: 0 },
    };
    expect(computeSignal(inputs, noBuzz).score).toBeLessThan(10);
  });

  it("Score bleibt im Bereich 0…100", () => {
    const base = baseInputs();
    const s = computeSignal({
      ...base,
      mentionsDaily: withLast(base.mentionsDaily, 1e9),
      sentimentDaily: withLast(base.sentimentDaily, 5),
      volumes: withLast(base.volumes, 1e12),
      newsDaily: withLast(base.newsDaily, 1e6),
    });
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.score).toBeGreaterThanOrEqual(0);
  });
});
