import type { ComponentKey, SignalType } from "@/config/signals";

/**
 * Rohdaten für das Scoring eines Werts. Alle Reihen sind chronologisch
 * (ältester Wert zuerst); der letzte Eintrag ist jeweils „heute“ bzw. der
 * jüngste Handelstag.
 */
export interface SignalInputs {
  /** Erwähnungen je Tag (letzter Eintrag = letzte 24 Std.). */
  mentionsDaily: readonly number[];
  /** Durchschnittliche Stimmung je Tag (−1…+1), null = keine Daten. Gleich lang wie mentionsDaily. */
  sentimentDaily: readonly (number | null)[];
  /** Tägliche Schlusskurse. */
  closes: readonly number[];
  /** Tägliche Volumina, gleich lang wie closes. */
  volumes: readonly number[];
  /** Anzahl Nachrichten je Tag (letzter Eintrag = heute). */
  newsDaily: readonly number[];
}

export type Direction = -1 | 0 | 1;

export interface ScoreComponent {
  key: ComponentKey;
  label: string;
  /** Normierter Teilscore 0…100. */
  score: number;
  /** Normiertes Gewicht 0…1. */
  weight: number;
  /** Beitrag zum Gesamtscore (weight × score), 0…100. */
  points: number;
  /** Richtung, die diese Komponente anzeigt. */
  direction: Direction;
  /** Ob genügend Daten für die Berechnung vorlagen. */
  available: boolean;
  /** Zugrunde liegende Messwerte für die Anzeige. */
  metrics: Record<string, number>;
  /** Allgemeinverständliche Erklärung des Messwerts. */
  detail: string;
}

export type SignalDirection = "bullish" | "bearish" | "neutral";
export type Confidence = "hoch" | "mittel" | "niedrig";

export interface Signal {
  /** Gesamtscore 0…100 (ganzzahlig). */
  score: number;
  components: ScoreComponent[];
  /** Dominanter Signaltyp (Komponente mit dem größten Beitrag). */
  type: SignalType;
  direction: SignalDirection;
  /** Richtungsneigung −1…+1. */
  bias: number;
  confidence: Confidence;
  /** Ob der Score die Markierungs-Schwelle erreicht. */
  flagged: boolean;
  /** Einzeilige Zusammenfassung, z. B. „Buzz-Ausbruch mit positiver Stimmung“. */
  headline: string;
  /** Begründungen in Alltagssprache, wichtigste zuerst. */
  reasons: string[];
  /** Hinweise zur Datenqualität. */
  caveats: string[];
}
