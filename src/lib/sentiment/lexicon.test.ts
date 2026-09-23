import { describe, expect, it } from "vitest";
import { lexiconSentiment, sentimentLabel, tokenize } from "./lexicon";

describe("lexiconSentiment", () => {
  it("erkennt positiven Slang", () => {
    const r = lexiconSentiment("$NVDA calls printing, this is going to the moon 🚀🚀");
    expect(r.score).toBeGreaterThan(0.5);
    expect(r.label).toBe("positiv");
    expect(r.hits.map((h) => h.token)).toContain("🚀");
  });

  it("erkennt negative Aussagen", () => {
    const r = lexiconSentiment("Terrible earnings miss, guidance lowered. Bagholder city 📉");
    expect(r.score).toBeLessThan(-0.5);
    expect(r.label).toBe("negativ");
  });

  it("versteht deutsche Beiträge", () => {
    expect(lexiconSentiment("Rheinmetall extrem stark, Kursziel hochgestuft, nachgekauft!").label).toBe("positiv");
    expect(lexiconSentiment("Gewinnwarnung bei Bayer, das war enttäuschend").label).toBe("negativ");
  });

  it("Negation kehrt Polarität um", () => {
    expect(lexiconSentiment("not bullish").score).toBeLessThan(0);
    expect(lexiconSentiment("nicht schlecht").score).toBeGreaterThan(0);
  });

  it("Verstärker erhöhen die Intensität", () => {
    expect(lexiconSentiment("very strong").score).toBeGreaterThan(lexiconSentiment("strong").score);
  });

  it("neutraler Text ergibt 0", () => {
    const r = lexiconSentiment("Earnings call is on Thursday after the close.");
    expect(r.score).toBe(0);
    expect(r.label).toBe("neutral");
  });

  it("Score liegt immer in −1…+1", () => {
    const r = lexiconSentiment("moon ".repeat(200));
    expect(r.score).toBeLessThanOrEqual(1);
    expect(r.score).toBeGreaterThan(0.99);
  });

  it("entfernt Cashtags beim Tokenisieren", () => {
    expect(tokenize("$TSLA to the moon")).toEqual(["to", "the", "moon"]);
  });

  it("sentimentLabel nutzt symmetrische Schwellen", () => {
    expect(sentimentLabel(0.2)).toBe("positiv");
    expect(sentimentLabel(-0.2)).toBe("negativ");
    expect(sentimentLabel(0.1)).toBe("neutral");
  });
});
