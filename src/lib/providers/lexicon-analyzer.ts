import type { Instrument } from "@/config/universe";
import { formatNumber } from "@/lib/format";
import { lexiconSentiment, sentimentLabel, tokenize } from "@/lib/sentiment/lexicon";
import type { Discussion, TextAnalyzer } from "./types";

const STOPWORDS = new Set(
  (
    "the a an and or but to of in on for with is are was were be been it its this that these those i you we they he she " +
    "my your our their at by from as so if not no yes up down out over about into than then too very just more most " +
    "any anyone else what why how who when where which im i'm it's dont don't can't will would should could has have had " +
    "der die das und oder aber zu von im in am an auf für mit ist sind war waren sein es ein eine einer eines den dem des " +
    "ich du wir ihr sie er nicht kein keine noch schon heute was wie wer wenn dann auch nur mal hier da bei nach aus vor " +
    "über unter mehr sehr jemand habe hat haben bin bist seid euch mir mich dir dich uns " +
    "again still today going looking keeps since know nothing yet here there some every other been being"
  ).split(" "),
);

/** Häufigste inhaltstragende Begriffe (für die Lexikon-Zusammenfassung). */
export function topTerms(texts: string[], exclude: string[], limit = 4): string[] {
  const counts = new Map<string, number>();
  const ex = new Set(exclude.map((e) => e.toLowerCase()));
  for (const text of texts) {
    const seen = new Set<string>();
    for (const token of tokenize(text)) {
      if (token.length < 4 || STOPWORDS.has(token) || ex.has(token) || /^\d+$/.test(token) || seen.has(token)) continue;
      seen.add(token);
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2 || texts.length < 4)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([t]) => t);
}

/** Regelbasierte Zusammenfassung – Fallback ohne KI. */
export function lexiconSummary(instrument: Instrument, discussions: Discussion[]): string | null {
  if (discussions.length === 0) return null;
  const labels = discussions.map((d) => sentimentLabel(d.sentiment));
  const pos = labels.filter((l) => l === "positiv").length;
  const neg = labels.filter((l) => l === "negativ").length;
  const neu = labels.length - pos - neg;
  const avg = discussions.reduce((a, d) => a + d.sentiment, 0) / discussions.length;
  const mood =
    avg >= 0.25 ? "überwiegend optimistisch" : avg <= -0.25 ? "überwiegend skeptisch" : avg >= 0.08 ? "leicht optimistisch" : avg <= -0.08 ? "leicht skeptisch" : "gespalten";
  const terms = topTerms(
    discussions.map((d) => `${d.title ?? ""} ${d.snippet}`),
    [instrument.ticker, instrument.name, ...instrument.name.split(" "), ...instrument.aliases],
  );
  const communities = [...new Set(discussions.map((d) => d.community))].slice(0, 2).join(" und ");
  const termPart = terms.length > 0 ? ` Häufige Themen: ${terms.map((t) => `„${t}“`).join(", ")}.` : "";
  return `Die ${discussions.length} meistbeachteten Beiträge (v. a. ${communities}) sind ${mood}: ${pos} positiv, ${neu} neutral, ${neg} negativ (Ø ${formatNumber(avg, 2, { sign: true })}).${termPart}`;
}

export const lexiconAnalyzer: TextAnalyzer = {
  id: "lexicon",
  label: "Lexikon-Analyse",
  mock: false,
  async scoreTexts(texts: string[]): Promise<number[]> {
    return texts.map((t) => lexiconSentiment(t).score);
  },
  async summarize(instrument, discussions) {
    const text = lexiconSummary(instrument, discussions);
    return text ? { text } : null;
  },
};
