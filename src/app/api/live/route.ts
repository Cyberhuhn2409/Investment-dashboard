import { NextResponse } from "next/server";
import { liveIntervalMs, liveMode, liveTicks, resolveLiveKeys, retainLive } from "@/lib/server/live";

export const dynamic = "force-dynamic";

/** Nach dieser Zeit schließt der Server den Stream; EventSource verbindet sich selbst neu. */
const MAX_STREAM_MS = 5 * 60_000;
const HEARTBEAT_MS = 20_000;

/**
 * Live-Kurse als Server-Sent Events (`?s=AAPL,SAP.DE,SPX`), mit `format=json`
 * als einmalige Abfrage. Gesendet werden nur geänderte Kurse.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const keys = resolveLiveKeys((url.searchParams.get("s") ?? "").split(","));
  if (keys.length === 0) {
    return NextResponse.json({ error: "Keine gültigen Symbole" }, { status: 400 });
  }

  if (url.searchParams.get("format") === "json") {
    try {
      const ticks = await liveTicks(keys);
      return NextResponse.json({ mode: liveMode(), ticks }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Datenquelle nicht erreichbar" }, { status: 502 });
    }
  }

  const encoder = new TextEncoder();
  const release = retainLive(keys);
  const lastSent = new Map<string, string>();
  const timers: ReturnType<typeof setInterval>[] = [];
  let closed = false;
  let busy = false;
  let sentMode = "";

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        timers.forEach(clearInterval);
        release();
        try {
          controller.close();
        } catch {
          // bereits geschlossen
        }
      };
      const push = async () => {
        if (busy || closed) return;
        busy = true;
        try {
          // Modus kann wechseln (z. B. Relay verbindet sich oder bricht ab)
          const mode = liveMode();
          if (mode !== sentMode) {
            sentMode = mode;
            write(`event: mode\ndata: ${JSON.stringify({ mode })}\n\n`);
          }
          const ticks = await liveTicks(keys);
          const changed = ticks.filter((t) => {
            const sig = `${t.p}|${t.m}`;
            if (lastSent.get(t.s) === sig) return false;
            lastSent.set(t.s, sig);
            return true;
          });
          if (changed.length > 0) write(`data: ${JSON.stringify(changed)}\n\n`);
        } catch {
          write(`event: unavailable\ndata: {}\n\n`);
        } finally {
          busy = false;
        }
      };

      write(`retry: 3000\n\n`);
      void push();
      timers.push(setInterval(push, liveIntervalMs()));
      timers.push(setInterval(() => write(`: ping\n\n`), HEARTBEAT_MS));
      timers.push(setTimeout(cleanup, MAX_STREAM_MS));
      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
      timers.forEach(clearInterval);
      release();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
