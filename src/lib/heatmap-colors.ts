/**
 * Farbskalen für die Heatmap. Alle Stufen haben mit weißer Schrift einen
 * Kontrast ≥ 4,5:1 (WCAG AA); Werte stehen zusätzlich als Text in den Kacheln.
 */
export type HeatMetric = "price" | "buzz" | "sentiment";
export type HeatPeriod = "1D" | "1W" | "1M";

type RGB = [number, number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const RED = hex("#b3261e");
const GREEN = hex("#1a7a3a");
const VIOLET = hex("#6a48dc");
const SLATE = hex("#3d4b63");
const NEUTRAL: Record<"dark" | "light", RGB> = { dark: hex("#2c2c31"), light: hex("#66666e") };

function mix(a: RGB, b: RGB, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const c = a.map((v, i) => Math.round(v + (b[i]! - v) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Wert, ab dem die Farbe voll gesättigt ist. */
export const PRICE_CAP: Record<HeatPeriod, number> = { "1D": 3, "1W": 6, "1M": 12 };
export const BUZZ_CAP = 300;
export const SENTIMENT_CAP = 0.5;

export function heatColor(metric: HeatMetric, value: number | null, theme: "dark" | "light", period: HeatPeriod = "1D"): string {
  const n = NEUTRAL[theme];
  if (value === null || !Number.isFinite(value)) return mix(n, n, 0);
  if (metric === "price") {
    const t = Math.abs(value) / PRICE_CAP[period];
    // leichte Gamma-Kurve: kleine Bewegungen bleiben erkennbar
    return mix(n, value >= 0 ? GREEN : RED, Math.pow(Math.min(t, 1), 0.75));
  }
  if (metric === "buzz") {
    if (value >= 0) return mix(n, VIOLET, Math.pow(Math.min(value / BUZZ_CAP, 1), 0.6));
    return mix(n, SLATE, Math.min(-value / 60, 1));
  }
  const t = Math.abs(value) / SENTIMENT_CAP;
  return mix(n, value >= 0 ? GREEN : RED, Math.pow(Math.min(t, 1), 0.8));
}

export function legendStops(metric: HeatMetric, theme: "dark" | "light", period: HeatPeriod): { color: string; label: string }[] {
  if (metric === "price") {
    const c = PRICE_CAP[period];
    return [
      { color: heatColor("price", -c, theme, period), label: `−${c} %` },
      { color: heatColor("price", 0, theme, period), label: "0" },
      { color: heatColor("price", c, theme, period), label: `+${c} %` },
    ];
  }
  if (metric === "buzz") {
    return [
      { color: heatColor("buzz", -60, theme), label: "weniger" },
      { color: heatColor("buzz", 0, theme), label: "üblich" },
      { color: heatColor("buzz", BUZZ_CAP, theme), label: `+${BUZZ_CAP} %` },
    ];
  }
  return [
    { color: heatColor("sentiment", -SENTIMENT_CAP, theme), label: "negativ" },
    { color: heatColor("sentiment", 0, theme), label: "neutral" },
    { color: heatColor("sentiment", SENTIMENT_CAP, theme), label: "positiv" },
  ];
}
