import { afterEach, describe, expect, it } from "vitest";
import { getInstrument } from "@/config/universe";
import { redditQuery } from "@/lib/providers/real/social";
import { buildRealProviders } from "./real-providers";

const KEYS = [
  "FINNHUB_API_KEY",
  "TWELVEDATA_API_KEY",
  "ALPHAVANTAGE_API_KEY",
  "ANTHROPIC_API_KEY",
  "APEWISDOM_ENABLED",
  "REDDIT_CLIENT_ID",
  "REDDIT_CLIENT_SECRET",
  "REDDIT_USER_AGENT",
];

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("Provider-Auswahl über .env", () => {
  it("ohne Schlüssel: keine echten Provider (Demo-Modus)", () => {
    const r = buildRealProviders();
    expect(r.count).toBe(0);
    expect(r.analyzer).toBeNull();
  });

  it("Finnhub allein deckt nur US-Werte ab", () => {
    process.env.FINNHUB_API_KEY = "test";
    const r = buildRealProviders();
    const price = r.price[0]!;
    expect(price.supports(getInstrument("AAPL")!)).toBe(true);
    expect(price.supports(getInstrument("SAP.DE")!)).toBe(false);
    expect(r.news[0]!.supports(getInstrument("AAPL")!)).toBe(true);
    expect(r.index).toBeNull();
  });

  it("Alpha Vantage ergänzt XETRA-Tageskurse, Twelve Data liefert ETF-Indizes", () => {
    process.env.TWELVEDATA_API_KEY = "t";
    process.env.ALPHAVANTAGE_API_KEY = "a";
    const r = buildRealProviders();
    expect(r.price[0]!.supports(getInstrument("SAP.DE")!)).toBe(true);
    expect(r.index?.id).toBe("twelvedata-etf");
    expect(r.infos.some((i) => i.attribution?.url.includes("twelvedata"))).toBe(true);
  });

  it("Reddit nur mit vollständigen Zugangsdaten", () => {
    process.env.REDDIT_CLIENT_ID = "id";
    expect(buildRealProviders().social).toHaveLength(0);
    process.env.REDDIT_CLIENT_SECRET = "secret";
    process.env.REDDIT_USER_AGENT = "web:signal:1.0 (by /u/test)";
    expect(buildRealProviders().social[0]!.id).toBe("reddit");
  });

  it("ApeWisdom ist opt-in und US-only", () => {
    process.env.APEWISDOM_ENABLED = "true";
    const s = buildRealProviders().social[0]!;
    expect(s.supports(getInstrument("NVDA")!)).toBe(true);
    expect(s.supports(getInstrument("RHM.DE")!)).toBe(false);
  });

  it("Anthropic-Schlüssel aktiviert die KI-Zusammenfassung", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    expect(buildRealProviders().analyzer?.id).toBe("anthropic");
  });
});

describe("Reddit-Suchanfragen", () => {
  it("nutzt Namen bei kurzen, mehrdeutigen Tickern", () => {
    expect(redditQuery(getInstrument("F")!)).toBe('"Ford Motor" OR "$F"');
    expect(redditQuery(getInstrument("NVDA")!)).toBe('"$NVDA" OR NVDA OR "Nvidia"');
    expect(redditQuery(getInstrument("RHM.DE")!)).toBe('"Rheinmetall" OR "$RHM"');
  });
});
