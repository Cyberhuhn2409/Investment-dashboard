import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FinnhubStream } from "./finnhub-stream";

/** Minimaler WebSocket-Ersatz: merkt sich gesendete Nachrichten, Tests lösen Ereignisse aus. */
class FakeSocket extends EventTarget {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: { type: string; symbol: string }[] = [];
  constructor(readonly url: string) {
    super();
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }
  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }
  message(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data) }));
  }
  subscribed(): string[] {
    const set = new Set<string>();
    for (const m of this.sent) {
      if (m.type === "subscribe") set.add(m.symbol);
      else set.delete(m.symbol);
    }
    return [...set].sort();
  }
}

describe("Finnhub-WebSocket-Relay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("verbindet bei Bedarf, abonniert und liefert Trades", () => {
    const s = new FinnhubStream("KEY", 50);
    expect(FakeSocket.instances).toHaveLength(0);
    const release = s.retain(["AAPL", "NVDA"]);
    const ws = FakeSocket.instances[0]!;
    expect(ws.url).toContain("token=KEY");
    expect(s.connected).toBe(false);
    ws.open();
    expect(s.connected).toBe(true);
    expect(ws.subscribed()).toEqual(["AAPL", "NVDA"]);
    ws.message({ type: "trade", data: [{ s: "NVDA", p: 180.5, t: 1_000, v: 3 }] });
    expect(s.latest("NVDA")).toMatchObject({ price: 180.5, time: 1_000 });
    release();
    expect(ws.subscribed()).toEqual([]);
    expect(s.latest("NVDA")).toBeUndefined();
  });

  it("zählt Referenzen und abonniert nur die meistgefragten Symbole", () => {
    const s = new FinnhubStream("KEY", 2);
    const a = s.retain(["AAPL", "MSFT", "NVDA"]);
    const b = s.retain(["NVDA", "TSLA", "MSFT"]);
    const ws = FakeSocket.instances[0]!;
    ws.open();
    // NVDA und MSFT sind doppelt gefragt → belegen die zwei Plätze
    expect(ws.subscribed()).toEqual(["MSFT", "NVDA"]);
    b();
    expect(ws.subscribed()).toEqual(["AAPL", "MSFT"]);
    a();
    expect(ws.subscribed()).toEqual([]);
  });

  it("verbindet nach Abbruch mit Backoff neu und abonniert erneut", () => {
    const s = new FinnhubStream("KEY", 50);
    s.retain(["AAPL"]);
    FakeSocket.instances[0]!.open();
    FakeSocket.instances[0]!.close();
    expect(s.connected).toBe(false);
    vi.advanceTimersByTime(2_100);
    expect(FakeSocket.instances).toHaveLength(2);
    const ws2 = FakeSocket.instances[1]!;
    ws2.open();
    expect(ws2.subscribed()).toEqual(["AAPL"]);
  });

  it("schließt die Verbindung, wenn niemand mehr zuhört", () => {
    const s = new FinnhubStream("KEY", 50);
    const release = s.retain(["AAPL"]);
    const ws = FakeSocket.instances[0]!;
    ws.open();
    release();
    vi.advanceTimersByTime(59_000);
    expect(ws.readyState).toBe(1);
    vi.advanceTimersByTime(2_000);
    expect(ws.readyState).toBe(3);
    // Kein Reconnect ohne Interesse
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
