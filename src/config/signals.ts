/**
 * Konfiguration der Signal-Berechnung. Gewichte, Kappungsgrenzen und Zeitfenster
 * sind bewusst hier gebündelt, damit das Scoring nachvollziehbar und ohne
 * Code-Änderung justierbar bleibt. Gewichte werden beim Scoring auf Summe 1
 * normiert.
 */
export const COMPONENT_KEYS = [
  "mentions",
  "sentimentLevel",
  "sentimentShift",
  "momentum",
  "volume",
  "news",
] as const;

export type ComponentKey = (typeof COMPONENT_KEYS)[number];

export interface SignalConfig {
  weights: Record<ComponentKey, number>;
  /** Wert, ab dem eine Komponente 100 Punkte erreicht (linear, gekappt). */
  caps: {
    /** z-Score der Erwähnungen ggü. Basislinie. */
    mentionsZ: number;
    /**
     * Mindest-Variationskoeffizient der Erwähnungen. Social-Zählungen streuen
     * stärker als Poisson; ohne Untergrenze würden ruhige Phasen jeden kleinen
     * Ausschlag zum Extremwert machen.
     */
    mentionsMinCv: number;
    /** Absolutes Stimmungsniveau (Skala −1…+1). */
    sentimentLevel: number;
    /** Absolute Stimmungsänderung ggü. Basislinie. */
    sentimentShift: number;
    /** Rendite / erwartete Schwankung (σ-Vielfache). */
    momentumZ: number;
    /** Volumen-Vielfaches über 1× (2 → 3× Volumen = 100 Punkte). */
    volumeExcess: number;
    /** Poisson-z-Score der Nachrichtenanzahl. */
    newsZ: number;
  };
  windows: {
    mentionBaselineDays: number;
    sentimentBaselineDays: number;
    momentumDays: number;
    volatilityDays: number;
    volumeBaselineDays: number;
    newsBaselineDays: number;
    /** Nachrichtenfenster für „aktuell“ in Tagen (2 = 48 Std.). */
    newsRecentDays: number;
  };
  thresholds: {
    /** Ab diesem Score gilt ein Wert als markiertes Signal. */
    flagged: number;
    /** Ab diesem Score gilt ein Signal als stark. */
    strong: number;
    /** Ab |bias| wird eine Richtung (positiv/negativ) ausgewiesen. */
    directionBias: number;
    /** Unter dieser mittleren Tagesanzahl an Erwähnungen ist die Datenbasis dünn. */
    minBaselineMentions: number;
    /** Ab dieser mittleren Tagesanzahl gilt die Datenbasis als solide. */
    solidBaselineMentions: number;
    /** Bei dünner Datenbasis wird die Buzz-Komponente hierauf gekappt. */
    thinDataMentionCap: number;
    /** Komponenten ab diesem Score werden in der Begründung genannt. */
    reasonMinScore: number;
  };
  /** Gewichtung der Richtungs-Indikatoren (Summe 1). */
  bias: {
    sentimentLevel: number;
    sentimentShift: number;
    momentum: number;
  };
}

export const SIGNAL_CONFIG: SignalConfig = {
  weights: {
    mentions: 0.3,
    sentimentLevel: 0.1,
    sentimentShift: 0.15,
    momentum: 0.2,
    volume: 0.15,
    news: 0.1,
  },
  caps: {
    mentionsZ: 4,
    mentionsMinCv: 0.25,
    sentimentLevel: 0.5,
    sentimentShift: 0.35,
    momentumZ: 2.5,
    volumeExcess: 2,
    newsZ: 3,
  },
  windows: {
    mentionBaselineDays: 30,
    sentimentBaselineDays: 7,
    momentumDays: 20,
    volatilityDays: 60,
    volumeBaselineDays: 20,
    newsBaselineDays: 30,
    newsRecentDays: 2,
  },
  thresholds: {
    flagged: 60,
    strong: 75,
    directionBias: 0.12,
    minBaselineMentions: 5,
    solidBaselineMentions: 20,
    thinDataMentionCap: 60,
    reasonMinScore: 40,
  },
  bias: {
    sentimentLevel: 0.45,
    sentimentShift: 0.2,
    momentum: 0.35,
  },
};

export const COMPONENT_META: Record<ComponentKey, { label: string; short: string; description: string }> = {
  mentions: {
    label: "Erwähnungs-Spike",
    short: "Buzz",
    description: "Erwähnungen der letzten 24 Std. im Vergleich zum 30-Tage-Durchschnitt (z-Score).",
  },
  sentimentLevel: {
    label: "Stimmungsniveau",
    short: "Stimmung",
    description: "Wie deutlich positiv oder negativ aktuell über den Wert diskutiert wird (−1 bis +1).",
  },
  sentimentShift: {
    label: "Stimmungswechsel",
    short: "Wechsel",
    description: "Veränderung der Stimmung gegenüber dem Durchschnitt der Vorwoche.",
  },
  momentum: {
    label: "Kursmomentum",
    short: "Momentum",
    description: "Kursveränderung über 20 Handelstage, gemessen an der üblichen Schwankung.",
  },
  volume: {
    label: "Volumen-Anomalie",
    short: "Volumen",
    description: "Handelsvolumen des letzten Handelstags im Vergleich zum 20-Tage-Schnitt.",
  },
  news: {
    label: "Nachrichtenlage",
    short: "News",
    description: "Anzahl der Nachrichten in 48 Std. im Vergleich zum üblichen Aufkommen.",
  },
};

export const SIGNAL_TYPES = [
  { id: "buzz", label: "Buzz-Ausbruch" },
  { id: "sentiment", label: "Stimmungswandel" },
  { id: "momentum", label: "Kursmomentum" },
  { id: "volume", label: "Volumen-Anomalie" },
  { id: "news", label: "Nachrichtenwelle" },
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number]["id"];

export const COMPONENT_TO_TYPE: Record<ComponentKey, SignalType> = {
  mentions: "buzz",
  sentimentLevel: "sentiment",
  sentimentShift: "sentiment",
  momentum: "momentum",
  volume: "volume",
  news: "news",
};

export function signalTypeLabel(type: SignalType): string {
  return SIGNAL_TYPES.find((t) => t.id === type)?.label ?? type;
}

/**
 * Relevanzfilter für das breite Universum: Standardansichten zeigen nur Werte,
 * bei denen gerade etwas passiert – ein markiertes Signal (Score ≥ flagged) oder
 * eine für den Wert ungewöhnlich große Tagesbewegung.
 */
export const RELEVANCE = {
  /** Tagesbewegung ab diesem Vielfachen der üblichen Tagesschwankung (σ). */
  moveZ: 2.5,
  /** Zeitraum für die übliche Tagesschwankung (Handelstage). */
  volatilityDays: 60,
} as const;
