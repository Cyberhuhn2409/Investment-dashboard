import "server-only";

/**
 * Prozessweiter In-Memory-Cache mit Stale-While-Revalidate:
 * - Frische Einträge (< ttl) werden direkt geliefert.
 * - Abgelaufene, aber noch nicht verworfene Einträge (< ttl + staleTtl) werden
 *   sofort geliefert und im Hintergrund erneuert.
 * - Schlägt eine Erneuerung fehl, bleibt der alte Wert erhalten und wird als
 *   „stale“ markiert (UI zeigt dann „Stand: …“ mit Hinweis).
 * - Parallele Anfragen auf denselben Schlüssel teilen sich eine Promise.
 */

export interface CacheResult<T> {
  value: T;
  fetchedAt: number;
  stale: boolean;
}

interface Entry<T> {
  value: T;
  fetchedAt: number;
  expiresAt: number;
  discardAt: number;
  failed: boolean;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<Entry<unknown>>>();
const MAX_ENTRIES = 5000;

export interface CacheOptions {
  /** Frische in ms */
  ttl: number;
  /** Zusätzliche Zeit, in der veraltete Werte noch ausgeliefert werden (ms). */
  staleTtl?: number;
}

function refresh<T>(key: string, loader: () => Promise<T>, opts: CacheOptions): Promise<Entry<T>> {
  const running = inflight.get(key) as Promise<Entry<T>> | undefined;
  if (running) return running;
  const p = (async () => {
    try {
      const value = await loader();
      const now = Date.now();
      const entry: Entry<T> = {
        value,
        fetchedAt: now,
        expiresAt: now + opts.ttl,
        discardAt: now + opts.ttl + (opts.staleTtl ?? opts.ttl * 10),
        failed: false,
      };
      if (store.size >= MAX_ENTRIES) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, entry as Entry<unknown>);
      return entry;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p as Promise<Entry<unknown>>);
  return p;
}

export async function cached<T>(key: string, loader: () => Promise<T>, opts: CacheOptions): Promise<CacheResult<T>> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;

  if (hit && now < hit.expiresAt) {
    return { value: hit.value, fetchedAt: hit.fetchedAt, stale: hit.failed };
  }

  if (hit && now < hit.discardAt) {
    // Im Hintergrund erneuern, alten Wert sofort liefern.
    refresh(key, loader, opts).catch(() => {
      hit.failed = true;
      hit.expiresAt = Date.now() + Math.min(opts.ttl, 60_000);
    });
    return { value: hit.value, fetchedAt: hit.fetchedAt, stale: hit.failed };
  }

  try {
    const entry = await refresh(key, loader, opts);
    return { value: entry.value, fetchedAt: entry.fetchedAt, stale: false };
  } catch (error) {
    if (hit) {
      hit.failed = true;
      return { value: hit.value, fetchedAt: hit.fetchedAt, stale: true };
    }
    throw error;
  }
}

/** Nur für Tests. */
export function clearCache(): void {
  store.clear();
  inflight.clear();
}
