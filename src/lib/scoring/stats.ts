export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function finite(values: readonly number[]): number[] {
  return values.filter((v) => Number.isFinite(v));
}

export function mean(values: readonly number[]): number {
  const v = finite(values);
  if (v.length === 0) return NaN;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** Stichproben-Standardabweichung (n−1). Bei < 2 Werten 0. */
export function stdev(values: readonly number[]): number {
  const v = finite(values);
  if (v.length < 2) return 0;
  const m = mean(v);
  const variance = v.reduce((acc, x) => acc + (x - m) ** 2, 0) / (v.length - 1);
  return Math.sqrt(variance);
}

export function weightedMean(values: readonly (number | null)[], weights: readonly number[]): number {
  let sum = 0;
  let wsum = 0;
  values.forEach((v, i) => {
    const w = weights[i] ?? 0;
    if (v === null || !Number.isFinite(v) || !(w > 0)) return;
    sum += v * w;
    wsum += w;
  });
  return wsum > 0 ? sum / wsum : NaN;
}

/**
 * z-Score mit Untergrenze für die Streuung. Die Untergrenze verhindert, dass
 * sehr ruhige Zeitreihen (σ≈0) bei kleinen Ausschlägen explodieren.
 */
export function zScore(value: number, baseline: readonly number[], minStd = 0): number {
  const m = mean(baseline);
  if (!Number.isFinite(m) || !Number.isFinite(value)) return NaN;
  const s = Math.max(stdev(baseline), minStd);
  if (s === 0) return value === m ? 0 : Math.sign(value - m) * Infinity;
  return (value - m) / s;
}

/** Tägliche einfache Renditen. */
export function returns(closes: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (prev !== undefined && cur !== undefined && prev > 0 && Number.isFinite(cur)) out.push(cur / prev - 1);
  }
  return out;
}

/** Letzte n Elemente (oder weniger, falls nicht vorhanden). */
export function tail<T>(values: readonly T[], n: number): T[] {
  if (n <= 0) return [];
  return values.slice(Math.max(0, values.length - n));
}

export function sum(values: readonly number[]): number {
  return finite(values).reduce((a, b) => a + b, 0);
}

export function round(value: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
