import "server-only";
import { parseFinnhubTrades, type StreamTrade } from "./parsers";

/**
 * Serverseitiges Relay des Finnhub-Trade-Streams (WebSocket, US-Aktien, im
 * Gratis-Tarif bis 50 Symbole). Ein Prozess hält genau eine Verbindung; Symbole
 * werden per Referenzzählung abonniert – die meistgefragten zuerst. Der
 * API-Schlüssel verlässt nie den Server, Browser erhalten die Kurse per SSE.
 */
export class FinnhubStream {
  private ws: WebSocket | null = null;
  private readonly wanted = new Map<string, number>();
  private readonly subscribed = new Set<string>();
  private readonly trades = new Map<string, StreamTrade>();
  private reconnectDelay = 2_000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private connectedAt = 0;

  constructor(
    private readonly apiKey: string,
    private readonly maxSymbols = Number(process.env.FINNHUB_WS_SYMBOLS ?? 50),
  ) {}

  static available(): boolean {
    return typeof globalThis.WebSocket === "function";
  }

  /** Symbole anfordern; die Rückgabe gibt sie wieder frei. */
  retain(symbols: readonly string[]): () => void {
    for (const s of symbols) this.wanted.set(s, (this.wanted.get(s) ?? 0) + 1);
    this.sync();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      for (const s of symbols) {
        const n = (this.wanted.get(s) ?? 0) - 1;
        if (n <= 0) this.wanted.delete(s);
        else this.wanted.set(s, n);
      }
      this.sync();
    };
  }

  /** Jüngster Trade eines Symbols (nur solange abonniert und verbunden). */
  latest(symbol: string): StreamTrade | undefined {
    return this.trades.get(symbol);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private target(): Set<string> {
    const ranked = [...this.wanted.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return new Set(ranked.slice(0, this.maxSymbols).map(([s]) => s));
  }

  private sync(): void {
    if (this.wanted.size === 0) {
      // Kurz offen halten, damit Seitenwechsel nicht neu verbinden
      this.idleTimer ??= setTimeout(() => this.close(), 60_000);
      this.applySubscriptions(new Set());
      return;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (!this.ws) this.connect();
    else this.applySubscriptions(this.target());
  }

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private applySubscriptions(target: Set<string>): void {
    if (!this.connected) return;
    for (const s of this.subscribed) {
      if (!target.has(s)) {
        this.send({ type: "unsubscribe", symbol: s });
        this.subscribed.delete(s);
        this.trades.delete(s);
      }
    }
    for (const s of target) {
      if (!this.subscribed.has(s)) {
        this.send({ type: "subscribe", symbol: s });
        this.subscribed.add(s);
      }
    }
  }

  private connect(): void {
    if (!FinnhubStream.available()) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(`wss://ws.finnhub.io?token=${encodeURIComponent(this.apiKey)}`);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.addEventListener("open", () => {
      this.connectedAt = Date.now();
      this.subscribed.clear();
      this.applySubscriptions(this.target());
    });
    ws.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      for (const trade of parseFinnhubTrades(event.data)) this.trades.set(trade.symbol, trade);
    });
    ws.addEventListener("close", () => {
      if (this.ws === ws) this.ws = null;
      this.subscribed.clear();
      // Stabile Verbindung → Backoff zurücksetzen
      if (Date.now() - this.connectedAt > 60_000) this.reconnectDelay = 2_000;
      if (this.wanted.size > 0) this.scheduleReconnect();
    });
    ws.addEventListener("error", () => {
      try {
        ws.close();
      } catch {
        // ignorieren
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60_000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.wanted.size > 0 && !this.ws) this.connect();
    }, delay);
  }

  private close(): void {
    this.idleTimer = null;
    if (this.wanted.size > 0) return;
    this.ws?.close();
    this.ws = null;
    this.subscribed.clear();
    this.trades.clear();
  }
}
