/**
 * Lexikonbasierte Stimmungsanalyse (Fallback ohne KI). Deckt Finanz-Slang aus
 * englischsprachigen Foren (r/wallstreetbets, r/stocks) und deutschsprachigen
 * Communities (r/mauerstrassenwetten, r/Finanzen) ab. Negationen kehren die
 * Polarität der folgenden Wörter um, Verstärker skalieren sie.
 *
 * Ergebnis: Score −1…+1 (VADER-ähnliche Normierung) plus Trefferliste, damit die
 * Einstufung in der UI erklärt werden kann.
 */

const POSITIVE: Record<string, number> = {
  // Englisch
  bullish: 2.5, bull: 1.5, moon: 2, mooning: 2.5, rocket: 1.5, "🚀": 2, "📈": 1.5, calls: 1.2, long: 1,
  buy: 1.2, buying: 1.2, bought: 1, beat: 2, beats: 2, crushed: 1.5, strong: 1.5, stronger: 1.5,
  upgrade: 2, upgraded: 2, outperform: 2, rally: 2, rallying: 2, breakout: 2, surge: 2, surging: 2,
  soar: 2.2, soaring: 2.2, undervalued: 2, cheap: 1, growth: 1.2, record: 1.2, profit: 1.2, profitable: 1.5,
  gains: 1.5, gain: 1.2, green: 1, winner: 1.5, love: 1.5, great: 1.5, good: 1, solid: 1.2, impressive: 1.8,
  tendies: 2, printing: 1.5, squeeze: 1.2, hold: 0.5, hodl: 1, raised: 1, raise: 0.8, guidance: 0.2,
  optimistic: 1.8, momentum: 0.8, recovery: 1.2, rebound: 1.5, dividend: 0.8, buyback: 1.5, partnership: 1,
  approval: 1.5, approved: 1.5, innovative: 1.2, dominant: 1.2, "all-time": 0.5, ath: 1.5,
  // Deutsch
  kaufen: 1.2, gekauft: 1, nachgekauft: 1.5, stark: 1.5, starke: 1.5, starkes: 1.5, rallye: 2, gewinn: 1.2, gewinne: 1.5,
  gewinner: 1.5, kursziel: 0.5, hochgestuft: 2, übertrifft: 2, übertroffen: 2, rekord: 1.5, günstig: 1,
  unterbewertet: 2, aufwärts: 1.5, steigt: 1.5, steigen: 1.2, gestiegen: 1.2, super: 1.5, gut: 1, gute: 1,
  optimistisch: 1.8, erholung: 1.2, dividende: 0.8, rückkauf: 1.5, durchbruch: 2, raketen: 2, rakete: 2,
  grün: 1, zugelegt: 1.2, positiv: 1.5, überzeugt: 1.2, chance: 1,
};

const NEGATIVE: Record<string, number> = {
  // Englisch
  bearish: -2.5, bear: -1.5, puts: -1.2, short: -1, shorting: -1.5, sell: -1.2, selling: -1.2, sold: -0.8,
  dump: -2, dumping: -2, crash: -2.5, crashing: -2.5, tank: -2, tanking: -2.2, tanked: -2, miss: -2, missed: -2,
  misses: -2, weak: -1.5, weaker: -1.5, downgrade: -2, downgraded: -2, underperform: -2, overvalued: -2,
  expensive: -1, bubble: -1.8, bagholder: -2, bagholding: -2, bags: -1.2, "📉": -1.5, red: -1, loss: -1.5,
  losses: -1.8, lost: -1.2, fraud: -3, lawsuit: -2, probe: -1.5, investigation: -1.5, recall: -1.5,
  layoffs: -1.2, cut: -1, cuts: -1, lowered: -1.5, warning: -1.5, bad: -1.5, terrible: -2.5, awful: -2.5,
  worried: -1.5, concern: -1.2, concerns: -1.2, risk: -0.6, risky: -1, fear: -1.8, panic: -2.2, drop: -1.5,
  dropped: -1.5, drops: -1.5, plunge: -2.5, plunging: -2.5, slump: -2, fall: -1.2, falling: -1.5, fell: -1.2,
  rugpull: -3, scam: -3, dilution: -1.8, bankrupt: -3, bankruptcy: -3, delisted: -2.5, halted: -1.5,
  // Deutsch
  verkaufen: -1.2, verkauft: -1, schwach: -1.5, schwache: -1.5, schwaches: -1.5, gewinnwarnung: -2.5,
  herabgestuft: -2, abgestuft: -2, verfehlt: -2, verlust: -1.5, verluste: -1.8, fällt: -1.5, fallen: -1.2,
  gefallen: -1.2, absturz: -2.5, abgestürzt: -2.5, crasht: -2.5, einbruch: -2, eingebrochen: -2, teuer: -1,
  überbewertet: -2, blase: -1.8, sorge: -1.5, sorgen: -1.5, angst: -1.8, risiko: -0.6, klage: -2,
  betrug: -3, pleite: -3, insolvenz: -3, rot: -1, schlecht: -1.5, schlechte: -1.5, enttäuschend: -2,
  enttäuscht: -1.8, abwärts: -1.5, negativ: -1.5, kürzung: -1.2, stellenabbau: -1.2,
};

const NEGATORS = new Set([
  "not", "no", "never", "don't", "dont", "isn't", "isnt", "wasn't", "wasnt", "aren't", "arent", "won't", "wont",
  "can't", "cant", "nicht", "kein", "keine", "keinen", "keiner", "nie", "niemals", "ohne",
]);

const INTENSIFIERS: Record<string, number> = {
  very: 1.4, extremely: 1.7, super: 1.3, huge: 1.4, massive: 1.5, really: 1.3, so: 1.2, insanely: 1.7,
  sehr: 1.4, extrem: 1.7, total: 1.3, mega: 1.5, richtig: 1.3, absolut: 1.4, massiv: 1.5,
  slightly: 0.6, somewhat: 0.7, bit: 0.7, etwas: 0.7, leicht: 0.6, kaum: 0.5,
};

const LEXICON: Record<string, number> = { ...POSITIVE, ...NEGATIVE };

export interface LexiconHit {
  token: string;
  weight: number;
}

export interface LexiconResult {
  /** −1…+1 */
  score: number;
  label: "positiv" | "negativ" | "neutral";
  hits: LexiconHit[];
}

export function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      // Emojis als eigene Tokens erhalten, Satzzeichen entfernen
      .replace(/(🚀|📈|📉)/gu, " $1 ")
      .replace(/[$#][a-z]{1,6}\b/g, " ")
      .split(/[^\p{L}\p{N}'’🚀📈📉-]+/u)
      .map((t) => t.replace(/’/g, "'").replace(/^-+|-+$/g, ""))
      .filter(Boolean)
  );
}

const ALPHA = 15; // Normierungskonstante wie bei VADER

export function lexiconSentiment(text: string): LexiconResult {
  const tokens = tokenize(text);
  const hits: LexiconHit[] = [];
  let total = 0;
  let negateWindow = 0;
  let intensity = 1;

  for (const token of tokens) {
    if (NEGATORS.has(token)) {
      negateWindow = 3;
      continue;
    }
    const boost = INTENSIFIERS[token];
    if (boost !== undefined && LEXICON[token] === undefined) {
      intensity = boost;
      continue;
    }
    const base = LEXICON[token];
    if (base !== undefined) {
      let w = base * intensity;
      if (negateWindow > 0) w *= -0.75;
      hits.push({ token, weight: w });
      total += w;
    }
    intensity = 1;
    if (negateWindow > 0) negateWindow--;
  }

  const score = total === 0 ? 0 : total / Math.sqrt(total * total + ALPHA);
  const label = score >= 0.15 ? "positiv" : score <= -0.15 ? "negativ" : "neutral";
  return { score, label, hits };
}

export function sentimentLabel(score: number): "positiv" | "negativ" | "neutral" {
  return score >= 0.15 ? "positiv" : score <= -0.15 ? "negativ" : "neutral";
}
