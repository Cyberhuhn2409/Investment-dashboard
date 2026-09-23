// Nachgebildete Anbieter (Finnhub REST + WebSocket, Twelve Data) für lokale
// Integrationstests des Echtdaten-Modus – ohne Schlüssel und ohne Internet.
// Start: node scripts/fake-providers.mjs [port]   (Standard 4010)
// App dagegen starten, z. B.:
//   FINNHUB_API_KEY=test FINNHUB_BASE_URL=http://127.0.0.1:4010/finnhub FINNHUB_WS_URL=ws://127.0.0.1:4010/ws \
//   TWELVEDATA_API_KEY=test TWELVEDATA_BASE_URL=http://127.0.0.1:4010/twelve npm run dev
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Grundkurs je Symbol (deterministisch, 20–520). */
const basePrice = (sym) => 20 + (hash(sym) % 50_000) / 100;
const iso = (ms) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

export function startFakeProviders(port = 4010) {
  const stats = { requests: {}, subscribed: new Set(), tradesSent: 0, connections: 0 };
  /** Steuerung für Tests: `reject = true` lehnt neue WebSocket-Verbindungen ab. */
  const control = { reject: false };
  const last = new Map(); // letzter Trade-Kurs je Symbol

  const price = (sym) => last.get(sym) ?? basePrice(sym);
  const json = (res, body, status = 200) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  const series = (sym, interval, size) => {
    const step = interval === "1day" ? 86_400_000 : interval === "30min" ? 1_800_000 : 300_000;
    const now = Date.now();
    const values = [];
    let p = basePrice(sym);
    for (let i = 0; i < size; i++) {
      const t = now - i * step;
      if (interval === "1day" && [0, 6].includes(new Date(t).getUTCDay())) continue;
      const wiggle = ((hash(`${sym}:${i}`) % 2000) / 1000 - 1) * 0.015;
      p = p * (1 - wiggle);
      values.push({
        datetime: interval === "1day" ? day(t) : iso(t),
        open: (p * 0.998).toFixed(2),
        high: (p * 1.01).toFixed(2),
        low: (p * 0.99).toFixed(2),
        close: p.toFixed(2),
        volume: String(1_000_000 + (hash(`${sym}:v:${i}`) % 5_000_000)),
      });
    }
    return { meta: { symbol: sym, interval }, values, status: "ok" };
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const key = url.pathname;
    stats.requests[key] = (stats.requests[key] ?? 0) + 1;
    const sym = url.searchParams.get("symbol") ?? "";
    const p = price(sym);
    switch (key) {
      case "/__stats":
        return json(res, { ...stats, subscribed: [...stats.subscribed].sort(), last: Object.fromEntries(last) });
      case "/finnhub/quote":
        return json(res, { c: p, d: p * 0.01, dp: 1, h: p * 1.01, l: p * 0.98, o: p * 0.99, pc: basePrice(sym) * 0.99, t: Math.floor(Date.now() / 1000) });
      case "/finnhub/stock/metric":
        return json(res, { metric: { "52WeekHigh": p * 1.3, "52WeekLow": p * 0.7, peTTM: 21.5, beta: 1.12, currentDividendYieldTTM: 0.8, "10DayAverageTradingVolume": 12.5 } });
      case "/finnhub/stock/profile2":
        return json(res, { marketCapitalization: 123_456 });
      case "/finnhub/company-news":
        return json(
          res,
          [1, 2, 3].map((i) => ({
            id: hash(`${sym}${i}`),
            datetime: Math.floor(Date.now() / 1000) - i * 3600,
            headline: `Testmeldung ${i} zu ${sym}`,
            source: "Fake Wire",
            summary: "Nachgebildete Nachricht für den Integrationstest.",
            url: `https://example.com/news/${sym}/${i}`,
          })),
        );
      case "/twelve/time_series":
        return json(res, series(sym, url.searchParams.get("interval") ?? "1day", Number(url.searchParams.get("outputsize") ?? 30)));
      case "/twelve/quote":
        return json(res, {
          close: String(p),
          previous_close: String(basePrice(sym) * 0.99),
          open: String(p * 0.99),
          high: String(p * 1.01),
          low: String(p * 0.98),
          volume: "1234567",
          timestamp: Math.floor(Date.now() / 1000),
          is_market_open: true,
        });
      default:
        return json(res, { error: "not found" }, 404);
    }
  });

  // WebSocket im Finnhub-Format: subscribe/unsubscribe, Trades alle 400 ms, Pings
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    if (control.reject) return ws.close(1013, "try again later");
    stats.connections++;
    const subs = new Set();
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === "subscribe") {
        subs.add(msg.symbol);
        stats.subscribed.add(msg.symbol);
      }
      if (msg.type === "unsubscribe") {
        subs.delete(msg.symbol);
        stats.subscribed.delete(msg.symbol);
      }
    });
    const timer = setInterval(() => {
      if (subs.size === 0) return ws.send(JSON.stringify({ type: "ping" }));
      const data = [...subs].map((s) => {
        const next = Math.round(price(s) * (1 + (Math.random() - 0.5) * 0.004) * 100) / 100;
        last.set(s, next);
        return { s, p: next, t: Date.now(), v: 10 };
      });
      stats.tradesSent += data.length;
      ws.send(JSON.stringify({ type: "trade", data }));
    }, 400);
    ws.on("close", () => {
      clearInterval(timer);
      for (const s of subs) stats.subscribed.delete(s);
    });
  });

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, wss, stats, last, control })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] ?? 4010);
  await startFakeProviders(port);
  console.log(`Fake-Anbieter läuft auf http://127.0.0.1:${port} (Finnhub: /finnhub, Twelve Data: /twelve, WebSocket: /ws)`);
}
