import "server-only";
import type { Instrument } from "@/config/universe";
import { lexiconAnalyzer } from "@/lib/providers/lexicon-analyzer";
import { createMockProviders } from "@/lib/providers/mock";
import type {
  IndexProvider,
  NewsProvider,
  PriceProvider,
  ProviderInfo,
  SocialProvider,
  TextAnalyzer,
} from "@/lib/providers/types";
import { nowMs } from "./clock";
import { buildRealProviders } from "./real-providers";

export interface ProviderSet {
  price(instrument: Instrument): PriceProvider;
  news(instrument: Instrument): NewsProvider;
  social(instrument: Instrument): SocialProvider;
  index: IndexProvider;
  analyzer: TextAnalyzer;
  /** Alle aktiven Quellen (für Statuszeile und Attribution). */
  active: ProviderInfo[];
  /** true, wenn ausschließlich Demo-Daten genutzt werden. */
  demo: boolean;
}

function pick<T extends ProviderInfo & { supports(i: Instrument): boolean }>(
  candidates: T[],
  fallback: T | null,
): (instrument: Instrument) => T {
  return (instrument) => {
    const hit = candidates.find((c) => c.supports(instrument));
    if (hit) return hit;
    if (fallback) return fallback;
    throw new Error(`Kein Datenanbieter für ${instrument.symbol} konfiguriert`);
  };
}

let cachedSet: ProviderSet | null = null;

/**
 * Wählt die Provider anhand der Umgebungsvariablen. Ohne Schlüssel läuft alles
 * auf deterministischen Demo-Daten. Mit Schlüsseln werden echte Anbieter
 * genutzt; Lücken (z. B. XETRA im Gratis-Tarif) fallen – gekennzeichnet – auf
 * Demo-Daten zurück, außer `ALLOW_MOCK_FALLBACK=false`.
 */
export function getProviders(): ProviderSet {
  if (cachedSet) return cachedSet;
  const mock = createMockProviders(nowMs);
  const real = buildRealProviders();
  const allowFallback = process.env.ALLOW_MOCK_FALLBACK !== "false" || real.count === 0;

  const set: ProviderSet = {
    price: pick(real.price, allowFallback ? mock.price : null),
    news: pick(real.news, allowFallback ? mock.news : null),
    social: pick(real.social, allowFallback ? mock.social : null),
    index: real.index ?? mock.index,
    analyzer: real.analyzer ?? lexiconAnalyzer,
    active: [],
    demo: real.count === 0,
  };
  const active: ProviderInfo[] = [...real.infos];
  if (real.count === 0 || allowFallback) active.push({ id: "mock", label: "Demo-Daten", mock: true });
  active.push(real.analyzer ?? lexiconAnalyzer);
  set.active = dedupe(active);
  cachedSet = set;
  return set;
}

function dedupe(items: ProviderInfo[]): ProviderInfo[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
