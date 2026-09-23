import "server-only";
import { RateLimitError, type RateLimiter } from "./rate-limit";

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface FetchJsonOptions {
  limiter: RateLimiter;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string;
  timeoutMs?: number;
  /** Wiederholungen bei 5xx/Netzwerkfehlern (nicht bei 4xx). */
  retries?: number;
  /** Next.js-Datacache-Revalidierung in Sekunden (nur GET). */
  revalidate?: number;
}

function parseRetryAfter(value: string | null): number {
  if (!value) return 60_000;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(1_000, secs * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(1_000, date - Date.now()) : 60_000;
}

/**
 * JSON-Abruf mit Rate-Limit, Timeout, Backoff und sauberer Fehlerbehandlung.
 * Schlüssel werden nie geloggt: Fehlermeldungen enthalten nur Host + Pfad.
 */
export async function fetchJson<T>(url: string, opts: FetchJsonOptions): Promise<T> {
  const retries = opts.retries ?? 2;
  const safeUrl = (() => {
    try {
      const u = new URL(url);
      return `${u.host}${u.pathname}`;
    } catch {
      return "unbekannte URL";
    }
  })();

  let attempt = 0;
  for (;;) {
    await opts.limiter.take();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
    try {
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        headers: { accept: "application/json", ...opts.headers },
        body: opts.body,
        signal: controller.signal,
        ...(opts.method === "POST"
          ? { cache: "no-store" as const }
          : opts.revalidate !== undefined
            ? { next: { revalidate: opts.revalidate } }
            : { cache: "no-store" as const }),
      });
      if (res.status === 429) {
        const wait = parseRetryAfter(res.headers.get("retry-after"));
        opts.limiter.penalize(wait);
        throw new RateLimitError(`${opts.limiter.name}: HTTP 429 (${safeUrl})`, wait);
      }
      if (res.status >= 500 && attempt < retries) {
        attempt++;
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new ProviderError(`${opts.limiter.name}: HTTP ${res.status} (${safeUrl})`, res.status);
      return (await res.json()) as T;
    } catch (error) {
      if (error instanceof RateLimitError || error instanceof ProviderError) throw error;
      if (attempt < retries) {
        attempt++;
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
        continue;
      }
      const reason = error instanceof Error && error.name === "AbortError" ? "Timeout" : "Netzwerkfehler";
      throw new ProviderError(`${opts.limiter.name}: ${reason} (${safeUrl})`);
    } finally {
      clearTimeout(timer);
    }
  }
}
