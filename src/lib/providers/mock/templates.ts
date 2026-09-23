/** Textbausteine für Demo-Diskussionen und -Nachrichten. {T} = Ticker, {N} = Name. */

export type Tone = "pos" | "neg" | "neu";

export const DISCUSSIONS_EN: Record<Tone, { title: string; body: string }[]> = {
  pos: [
    { title: "{T} looking strong into earnings", body: "{T} looking really strong into earnings, loading more calls. Volume is picking up and the chart just broke out 🚀" },
    { title: "Buying the dip on {T}?", body: "Anyone else buying the dip on {T}? Fundamentals are solid imo, margins keep improving and the buyback is huge." },
    { title: "{N} breakout", body: "{N} just broke out of the range on massive volume. Momentum is real, not selling a single share." },
    { title: "Upgrade: price target raised on {T}", body: "Analyst upgrade on {T} today, price target raised again. Holding long, this is a great setup." },
    { title: "DD: why {N} is still undervalued", body: "DD: why {N} is still undervalued at these levels – record revenue, strong guidance and growth in every segment." },
  ],
  neg: [
    { title: "{T} guidance was weak", body: "{T} guidance was weak and the call was awful. I'm out, way too expensive here." },
    { title: "Bagholding {T}", body: "Bagholding {T} since last quarter, this keeps dropping 📉 anyone else worried about the margins?" },
    { title: "Puts on {T}", body: "Bought puts on {T} – the valuation makes no sense after this run. Looks like a bubble to me." },
    { title: "Concerns about {N}", body: "Concerned about the numbers at {N}. Weak demand, lowered outlook, downgrade incoming?" },
  ],
  neu: [
    { title: "{T} ahead of the earnings call", body: "What's the consensus on {T} ahead of the earnings call on Thursday? Trying to understand the expectations." },
    { title: "Unusual options activity in {T}", body: "{N} options activity is unusual today – anyone know what's going on? Nothing in the news yet." },
    { title: "How do you value {T}?", body: "Comparing {T} with its peers – how do you value it? Looking at cash flow and the debt situation." },
  ],
};

export const DISCUSSIONS_DE: Record<Tone, { title: string; body: string }[]> = {
  pos: [
    { title: "{N} heute wieder stark", body: "{N} heute wieder richtig stark, habe nachgekauft. Das Volumen zieht an 🚀" },
    { title: "Kursziel für {N} hochgestuft", body: "Kursziel für {N} hochgestuft – bin weiter long, das Chartbild ist super." },
    { title: "DD: {N} unterbewertet?", body: "Warum {N} aus meiner Sicht noch unterbewertet ist: starker Auftragseingang, Rekord beim Umsatz, Dividende steigt." },
  ],
  neg: [
    { title: "{N} nach der Gewinnwarnung", body: "{N} nach der Gewinnwarnung – ist der Absturz schon vorbei? Sieht für mich weiter schwach aus." },
    { title: "Bei {N} raus", body: "Bin bei {N} raus, die Zahlen waren enttäuschend und die Sorgen um die Marge sind berechtigt." },
    { title: "{N} fällt und fällt", body: "{N} fällt und fällt. Wer hält hier noch? Die Bewertung ist mir zu teuer." },
  ],
  neu: [
    { title: "{N} vor den Quartalszahlen", body: "Was haltet ihr von {N} vor den Quartalszahlen nächste Woche? Bin unentschlossen." },
    { title: "Meinungen zu {N}?", body: "{N}: Hat jemand eine Meinung zur aktuellen Bewertung im Vergleich zur Konkurrenz?" },
  ],
};

export const NEWS_HEADLINES: Record<Tone, string[]> = {
  pos: [
    "{N} übertrifft Umsatzerwartungen deutlich",
    "Analysten heben Kursziel für {N} an",
    "{N} kündigt Aktienrückkauf an",
    "{N} gewinnt Großauftrag – Aktie legt zu",
    "{N} hebt Jahresprognose an",
    "Starke Nachfrage stützt {N}",
  ],
  neg: [
    "{N} senkt Ausblick für das Gesamtjahr",
    "Analyst stuft {N} ab",
    "{N} verfehlt Gewinnerwartungen",
    "Behörde prüft Geschäftspraktiken von {N}",
    "{N}: Margendruck belastet Quartalszahlen",
    "Schwache Nachfrage – {N} unter Druck",
  ],
  neu: [
    "{N} lädt zum Kapitalmarkttag",
    "{N} stellt neues Produkt vor",
    "Personalwechsel im Vorstand von {N}",
    "{N}: Was Anleger vor den Zahlen wissen sollten",
    "Branchenbericht: Wie sich {N} im Wettbewerb schlägt",
    "{N} bestätigt Prognose",
  ],
};

export const NEWS_SOURCES = ["Marktbericht", "Unternehmensmeldung", "Analystenkommentar", "Branchennews", "Wirtschaftspresse"];

export function fill(template: string, ticker: string, name: string): string {
  return template.replaceAll("{T}", `$${ticker}`).replaceAll("{N}", name);
}
