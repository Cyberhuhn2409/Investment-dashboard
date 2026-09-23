import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Wartezeit-Budget für alle Anbieteraufrufe innerhalb eines Ablaufs. Die
 * Marktübersicht lädt mit Budget 0 („nimm, was sofort geht“), damit eine Seite
 * nie minutenlang auf Kontingente wartet; der Hintergrund-Lader wartet länger.
 */
const budget = new AsyncLocalStorage<{ maxWaitMs: number }>();

export function withLimiterBudget<T>(maxWaitMs: number, fn: () => Promise<T>): Promise<T> {
  return budget.run({ maxWaitMs }, fn);
}

/**
 * Token-Bucket je Provider. Anfragen warten, bis ein Token frei ist; nach einem
 * HTTP 429 pausiert der Bucket („Cooldown“), damit wir das Limit des Anbieters
 * nicht weiter strapazieren. Zusätzlich optionales Tageskontingent.
 */
export interface LimiterOptions {
  /** Anfragen pro Minute */
  perMinute: number;
  /** Optionales Tageslimit (UTC-Tag). */
  perDay?: number;
  /** Maximale Wartezeit in ms, danach wird abgebrochen. */
  maxWaitMs?: number;
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private cooldownUntil = 0;
  private dayKey = "";
  private dayCount = 0;

  constructor(
    readonly name: string,
    private readonly opts: LimiterOptions,
    private readonly clock: () => number = Date.now,
  ) {
    this.tokens = opts.perMinute;
    this.lastRefill = clock();
  }

  private refill(): void {
    const now = this.clock();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.opts.perMinute, this.tokens + (elapsed / 60_000) * this.opts.perMinute);
    this.lastRefill = now;
  }

  private checkDay(): void {
    const key = new Date(this.clock()).toISOString().slice(0, 10);
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.dayCount = 0;
    }
  }

  /** Zeit bis zum nächsten verfügbaren Token (ms), 0 = sofort. */
  waitTime(): number {
    this.refill();
    const now = this.clock();
    if (now < this.cooldownUntil) return this.cooldownUntil - now;
    if (this.tokens >= 1) return 0;
    return Math.ceil(((1 - this.tokens) / this.opts.perMinute) * 60_000);
  }

  /** Versucht, sofort ein Token zu nehmen. */
  tryTake(): boolean {
    this.checkDay();
    if (this.opts.perDay !== undefined && this.dayCount >= this.opts.perDay) return false;
    if (this.waitTime() > 0) return false;
    this.tokens -= 1;
    this.dayCount += 1;
    return true;
  }

  /** Wartet auf ein Token oder wirft RateLimitError, wenn die Wartezeit zu lang wäre. */
  async take(): Promise<void> {
    const maxWait = budget.getStore()?.maxWaitMs ?? this.opts.maxWaitMs ?? 8_000;
    const start = this.clock();
    for (;;) {
      this.checkDay();
      if (this.opts.perDay !== undefined && this.dayCount >= this.opts.perDay) {
        throw new RateLimitError(`${this.name}: Tageslimit erreicht`, 3_600_000);
      }
      if (this.tryTake()) return;
      const wait = this.waitTime();
      if (this.clock() - start + wait > maxWait) {
        throw new RateLimitError(`${this.name}: Rate-Limit – Anfrage verschoben`, wait);
      }
      await new Promise((r) => setTimeout(r, Math.max(wait, 25)));
    }
  }

  /** Nach HTTP 429: Bucket leeren und pausieren. */
  penalize(retryAfterMs: number): void {
    this.tokens = 0;
    this.cooldownUntil = Math.max(this.cooldownUntil, this.clock() + retryAfterMs);
  }
}

const limiters = new Map<string, RateLimiter>();

export function getLimiter(name: string, opts: LimiterOptions): RateLimiter {
  let l = limiters.get(name);
  if (!l) {
    l = new RateLimiter(name, opts);
    limiters.set(name, l);
  }
  return l;
}
