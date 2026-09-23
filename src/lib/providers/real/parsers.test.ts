import { describe, expect, it } from "vitest";
import {
  ProviderLimitError,
  alphaTime,
  dailyCounts,
  parseAlphaDaily,
  parseAlphaNews,
  parseApeWisdom,
  parseFinnhubMetrics,
  parseFinnhubNews,
  parseFinnhubQuote,
  parseFinnhubTrades,
  parseRedditListing,
  parseTwelveQuote,
  parseTwelveSeries,
  redditToDiscussion,
} from "./parsers";

// Fixtures nach den dokumentierten Antwortformaten der Anbieter (gekürzt).

describe("Finnhub", () => {
  it("parst /quote", () => {
    const q = parseFinnhubQuote({ c: 232.5, d: 1.5, dp: 0.65, h: 233, l: 229.1, o: 230, pc: 231, t: 1758650400 });
    expect(q.price).toBe(232.5);
    expect(q.prevClose).toBe(231);
    expect(q.time).toBe(1758650400000);
  });

  it("lehnt leere Kurse ab (unbekanntes Symbol liefert c=0)", () => {
    expect(() => parseFinnhubQuote({ c: 0, pc: 0 })).toThrow();
  });

  it("parst Kennzahlen mit Fallback-Schlüsseln", () => {
    const m = parseFinnhubMetrics({
      metric: { "52WeekHigh": 260.1, "52WeekLow": 164.1, peBasicExclExtraTTM: 35.2, beta: 1.2, "10DayAverageTradingVolume": 52.3 },
    });
    expect(m.pe).toBe(35.2);
    expect(m.avgVolume).toBeCloseTo(52.3e6);
    expect(m.dividendYieldPct).toBeNull();
  });

  it("parst /company-news und sortiert neueste zuerst", () => {
    const items = parseFinnhubNews([
      { id: 1, datetime: 1758600000, headline: "Älter", source: "Reuters", summary: "", url: "https://a" },
      { id: 2, datetime: 1758650000, headline: "Neuer", source: "CNBC", summary: "Text", url: "https://b" },
      { id: 3, datetime: 1758650000, headline: "", url: "https://c" },
    ]);
    expect(items.map((i) => i.headline)).toEqual(["Neuer", "Älter"]);
    expect(items[1]!.summary).toBeNull();
  });
});

describe("Finnhub WebSocket", () => {
  it("liefert je Symbol den jüngsten Trade", () => {
    const msg = JSON.stringify({
      type: "trade",
      data: [
        { s: "AAPL", p: 232.1, t: 1_758_650_000_000, v: 10 },
        { s: "AAPL", p: 232.4, t: 1_758_650_000_900, v: 5 },
        { s: "NVDA", p: 178.02, t: 1_758_650_000_100, v: 100 },
        { s: "BAD", p: -1, t: 1 },
      ],
    });
    const trades = parseFinnhubTrades(msg);
    expect(trades).toHaveLength(2);
    expect(trades.find((t) => t.symbol === "AAPL")).toMatchObject({ price: 232.4, time: 1_758_650_000_900 });
  });

  it("ignoriert Pings, Fehler und kaputtes JSON", () => {
    expect(parseFinnhubTrades('{"type":"ping"}')).toEqual([]);
    expect(parseFinnhubTrades('{"type":"error","msg":"Subscribing to too many symbols"}')).toEqual([]);
    expect(parseFinnhubTrades("nicht json")).toEqual([]);
  });
});

describe("Twelve Data", () => {
  it("parst time_series (Strings, neueste zuerst) chronologisch", () => {
    const candles = parseTwelveSeries(
      {
        meta: { symbol: "AAPL", interval: "1day" },
        values: [
          { datetime: "2026-09-23", open: "230", high: "233", low: "229", close: "232.5", volume: "51000000" },
          { datetime: "2026-09-22", open: "228", high: "231", low: "227", close: "230", volume: "48000000" },
        ],
        status: "ok",
      },
      true,
    );
    expect(candles.map((c) => c.c)).toEqual([230, 232.5]);
    expect(candles[1]!.t).toBe(Date.UTC(2026, 8, 23) / 1000);
    expect(candles[1]!.v).toBe(51_000_000);
  });

  it("interpretiert Intraday-Zeiten als UTC", () => {
    const c = parseTwelveSeries({ values: [{ datetime: "2026-09-23 13:30:00", open: "1", high: "1", low: "1", close: "1" }] }, false);
    expect(c[0]!.t).toBe(Date.UTC(2026, 8, 23, 13, 30) / 1000);
  });

  it("meldet Rate-Limit als ProviderLimitError", () => {
    expect(() => parseTwelveSeries({ code: 429, message: "You have run out of API credits", status: "error" }, true)).toThrow(
      ProviderLimitError,
    );
    expect(() => parseTwelveSeries({ code: 400, message: "symbol not found", status: "error" }, true)).toThrow(/symbol/);
  });

  it("parst /quote", () => {
    const q = parseTwelveQuote({ close: "232.5", previous_close: "231", open: "230", high: "233", low: "229", volume: "100", timestamp: 1758650400, is_market_open: true });
    expect(q.price).toBe(232.5);
    expect(q.marketOpen).toBe(true);
  });
});

describe("Alpha Vantage", () => {
  it("parst TIME_SERIES_DAILY", () => {
    const c = parseAlphaDaily({
      "Meta Data": {},
      "Time Series (Daily)": {
        "2026-09-23": { "1. open": "230.1", "2. high": "233.0", "3. low": "229.5", "4. close": "232.0", "5. volume": "123" },
        "2026-09-22": { "1. open": "228.0", "2. high": "231.0", "3. low": "227.0", "4. close": "230.0", "5. volume": "100" },
      },
    });
    expect(c.map((x) => x.c)).toEqual([230, 232]);
  });

  it("erkennt das Tageslimit (HTTP 200 mit Information)", () => {
    expect(() => parseAlphaDaily({ Information: "We have detected your API key ... 25 requests per day." })).toThrow(ProviderLimitError);
  });

  it("parst NEWS_SENTIMENT inkl. Zeitformat", () => {
    expect(alphaTime("20260923T143000")).toBe(Date.UTC(2026, 8, 23, 14, 30));
    const items = parseAlphaNews({
      feed: [{ title: "Apple beats", url: "https://x", time_published: "20260923T143000", source: "Benzinga", summary: "s", overall_sentiment_score: 0.31 }],
    });
    expect(items[0]!.sentiment).toBeCloseTo(0.31);
  });
});

describe("ApeWisdom", () => {
  it("parst Ergebnisse (Zahlen können Strings sein)", () => {
    const r = parseApeWisdom({
      count: 2,
      pages: 3,
      current_page: 1,
      results: [
        { rank: 1, ticker: "NVDA", name: "NVIDIA", mentions: "812", upvotes: "5000", rank_24h_ago: 2, mentions_24h_ago: "400" },
        { rank: 2, ticker: "tsla", name: "Tesla", mentions: 500, upvotes: 10, rank_24h_ago: 1, mentions_24h_ago: 700 },
      ],
    });
    expect(r.pages).toBe(3);
    expect(r.rows[0]).toEqual({ ticker: "NVDA", mentions: 812, mentions24hAgo: 400, upvotes: 5000, rank: 1 });
    expect(r.rows[1]!.ticker).toBe("TSLA");
  });
});

describe("Reddit", () => {
  const listing = {
    kind: "Listing",
    data: {
      children: [
        {
          kind: "t3",
          data: {
            id: "abc",
            title: "NVDA calls printing",
            selftext: "Loading more calls, strong quarter ahead " + "x".repeat(400),
            subreddit: "wallstreetbets",
            score: 1200,
            num_comments: 300,
            created_utc: 1758650400,
            permalink: "/r/wallstreetbets/comments/abc/nvda/",
          },
        },
      ],
    },
  };

  it("parst Listings und baut Diskussionen", () => {
    const posts = parseRedditListing(listing);
    expect(posts[0]!.url).toBe("https://www.reddit.com/r/wallstreetbets/comments/abc/nvda/");
    const d = redditToDiscussion(posts[0]!, 0.6);
    expect(d.community).toBe("r/wallstreetbets");
    expect(d.snippet.length).toBeLessThanOrEqual(280);
    expect(d.snippet.endsWith("…")).toBe(true);
  });
});

describe("dailyCounts", () => {
  it("zählt Ereignisse je UTC-Tag, heute zuletzt", () => {
    const now = Date.UTC(2026, 8, 23, 12);
    const counts = dailyCounts([now, now - 3_600_000, now - 86_400_000, now - 10 * 86_400_000], 3, now);
    expect(counts).toEqual([0, 1, 2]);
  });
});
