import { RELEVANCE, SIGNAL_CONFIG } from "@/config/signals";
import { stdev } from "@/lib/scoring/stats";

/**
 * Letzte Tagesbewegung in Vielfachen der üblichen Tagesschwankung.
 * `closes` endet mit dem aktuellen Kurs; die Streuung stammt aus den Tagen davor.
 */
export function dailyMoveZ(closes: readonly number[], days: number = RELEVANCE.volatilityDays): number {
  if (closes.length < 12) return 0;
  const returns: number[] = [];
  for (let i = Math.max(1, closes.length - 1 - days); i < closes.length; i++) {
    const prev = closes[i - 1]!;
    const cur = closes[i]!;
    if (prev > 0 && cur > 0) returns.push(Math.log(cur / prev));
  }
  const today = returns.pop();
  if (today === undefined || returns.length < 10) return 0;
  const sigma = Math.max(stdev(returns), 0.004);
  return today / sigma;
}

export interface RelevanceInput {
  score: number;
  moveZ: number;
}

export function isRelevant(r: RelevanceInput): boolean {
  return r.score >= SIGNAL_CONFIG.thresholds.flagged || Math.abs(r.moveZ) >= RELEVANCE.moveZ;
}

/** Kurzbegründung für Werte, die nur wegen ihrer Tagesbewegung relevant sind. */
export function moveHighlight(changePct: number, moveZ: number): string {
  const pct = `${changePct >= 0 ? "+" : "−"}${Math.abs(changePct).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  const z = Math.abs(moveZ).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `Tagesbewegung ${pct} – ${z}× die übliche Schwankung`;
}
