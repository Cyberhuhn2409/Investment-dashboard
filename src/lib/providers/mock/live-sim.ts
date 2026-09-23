/**
 * Deterministische Kurs-Simulation für den Demo-Livebetrieb.
 *
 * Der Kurs ist eine reine Funktion von Symbol und Zeit (mehrere Oktaven
 * Value-Noise, ähnlich einer Brownschen Bewegung), damit Server-Rendering und
 * Live-Stream denselben Wert liefern, ohne Zustand zu halten. Nicht jede Sekunde
 * wird „gehandelt“: kleinere Werte ticken seltener.
 */
import { hashString } from "@/lib/random";

function unit(seed: number, i: number): number {
  let h = (seed ^ Math.imul(i | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = unit(seed, i) * 2 - 1;
  const b = unit(seed, i + 1) * 2 - 1;
  return a + (b - a) * u;
}

/** [Periode in Sekunden, Gewicht] – kurze Perioden = Ticks, lange = Tagesverlauf. */
const OCTAVES: readonly (readonly [number, number])[] = [
  [3, 0.08],
  [11, 0.14],
  [41, 0.22],
  [150, 0.3],
  [600, 0.42],
  [2400, 0.55],
];
const NORM = OCTAVES.reduce((a, [, w]) => a + w, 0);

export interface SimParams {
  key: string;
  /** Referenzkurs (Schlusskurs der Mock-Serie) */
  base: number;
  /** Tägliche Volatilität (σ) */
  dailyVol: number;
  /** Anteil der Sekunden mit Handel (0…1) */
  liquidity: number;
}

const seeds = new Map<string, number>();
function seedFor(key: string): number {
  let s = seeds.get(key);
  if (s === undefined) {
    s = hashString(`live:${key}`) >>> 0;
    seeds.set(key, s);
  }
  return s;
}

export function roundPrice(p: number): number {
  const digits = p >= 1 ? 2 : 4;
  const f = 10 ** digits;
  return Math.round(p * f) / f;
}

/** Simulierter Kurs zum Zeitpunkt `tMs` samt Zeitpunkt des letzten „Trades“. */
export function simulatedTick(p: SimParams, tMs: number): { price: number; time: number } {
  const seed = seedFor(p.key);
  let sec = Math.floor(tMs / 1000);
  for (let k = 0; k < 30; k++) {
    if (unit(seed ^ 0x5bd1e995, sec) < p.liquidity) break;
    sec--;
  }
  let n = 0;
  for (const [period, w] of OCTAVES) n += valueNoise(seed + period, sec / period) * w;
  n /= NORM;
  return { price: roundPrice(p.base * Math.exp(n * p.dailyVol * 0.6)), time: sec * 1000 };
}
