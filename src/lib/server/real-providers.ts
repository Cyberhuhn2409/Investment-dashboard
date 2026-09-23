import "server-only";
import type {
  IndexProvider,
  NewsProvider,
  PriceProvider,
  ProviderInfo,
  SocialProvider,
  TextAnalyzer,
} from "@/lib/providers/types";

export interface RealProviders {
  price: PriceProvider[];
  news: NewsProvider[];
  social: SocialProvider[];
  index: IndexProvider | null;
  analyzer: TextAnalyzer | null;
  infos: ProviderInfo[];
  count: number;
}

/** Baut echte Provider aus Umgebungsvariablen (Schlüssel bleiben serverseitig). */
export function buildRealProviders(): RealProviders {
  return { price: [], news: [], social: [], index: null, analyzer: null, infos: [], count: 0 };
}
