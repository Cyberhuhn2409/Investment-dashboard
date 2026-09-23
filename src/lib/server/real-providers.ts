import "server-only";
import { lexiconAnalyzer } from "@/lib/providers/lexicon-analyzer";
import { createAnthropicAnalyzer } from "@/lib/providers/real/anthropic";
import {
  createAlphaVantage,
  createCompositePrice,
  createFinnhub,
  createNewsProvider,
  createProxyIndexProvider,
  createTwelveData,
} from "@/lib/providers/real/market-data";
import { createApeWisdom, createReddit, createSocialProvider } from "@/lib/providers/real/social";
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

const env = (key: string) => {
  const v = process.env[key]?.trim();
  return v ? v : undefined;
};

/**
 * Baut echte Provider aus Umgebungsvariablen. Schlüssel werden nur hier –
 * serverseitig – gelesen und nie an den Client gegeben (keine NEXT_PUBLIC_-Präfixe).
 */
export function buildRealProviders(): RealProviders {
  const finnhubKey = env("FINNHUB_API_KEY");
  const twelveKey = env("TWELVEDATA_API_KEY");
  const alphaKey = env("ALPHAVANTAGE_API_KEY");
  const anthropicKey = env("ANTHROPIC_API_KEY");
  const redditId = env("REDDIT_CLIENT_ID");
  const redditSecret = env("REDDIT_CLIENT_SECRET");
  const redditUa = env("REDDIT_USER_AGENT");
  const apeEnabled = env("APEWISDOM_ENABLED") === "true";

  const finnhub = finnhubKey ? createFinnhub(finnhubKey) : undefined;
  const twelve = twelveKey ? createTwelveData(twelveKey) : undefined;
  const alpha = alphaKey ? createAlphaVantage(alphaKey) : undefined;
  const analyzer = anthropicKey ? createAnthropicAnalyzer(anthropicKey) : null;
  const ape = apeEnabled ? createApeWisdom() : undefined;
  const reddit =
    redditId && redditSecret && redditUa
      ? createReddit(redditId, redditSecret, redditUa, analyzer ?? lexiconAnalyzer)
      : undefined;

  const price = createCompositePrice({ finnhub, twelve, alpha });
  const news = createNewsProvider({ finnhub, alpha });
  const social = createSocialProvider({ ape, reddit });
  const index = createProxyIndexProvider(twelve);

  const infos: ProviderInfo[] = [];
  for (const p of [price, index, news, social]) {
    if (p) infos.push({ id: p.id, label: p.label, mock: false, attribution: p.attribution });
  }
  const count = [price, news, social].filter(Boolean).length;
  return {
    price: price ? [price] : [],
    news: news ? [news] : [],
    social: social ? [social] : [],
    index,
    analyzer,
    infos,
    count,
  };
}
