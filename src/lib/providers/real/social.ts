import "server-only";
import type { Instrument } from "@/config/universe";
import { fetchJson } from "@/lib/server/http";
import { getLimiter } from "@/lib/server/rate-limit";
import type { Discussion, SocialData, SocialDay, SocialProvider, TextAnalyzer } from "../types";
import { mentionHistory, recordMentions } from "./mention-store";
import { parseApeWisdom, parseRedditListing, redditToDiscussion, type ApeWisdomRow, type RedditPost } from "./parsers";

const DAY_S = 86_400;

/* ============================== ApeWisdom ============================== */
// Öffentliche API ohne Schlüssel: Reddit-/4chan-Erwähnungen je US-Ticker
// (aktuell + vor 24 Std.). Keine Texte, keine Stimmung. Wir fragen höchstens
// alle 15 Minuten ab und bauen die Tageshistorie selbst auf.

export function createApeWisdom() {
  const limiter = getLimiter("apewisdom", { perMinute: 10 });
  let snapshot: { at: number; rows: Map<string, ApeWisdomRow> } | null = null;
  let inflight: Promise<Map<string, ApeWisdomRow>> | null = null;

  async function load(): Promise<Map<string, ApeWisdomRow>> {
    if (snapshot && Date.now() - snapshot.at < 15 * 60_000) return snapshot.rows;
    if (inflight) return inflight;
    inflight = (async () => {
      const rows = new Map<string, ApeWisdomRow>();
      const maxPages = Number(process.env.APEWISDOM_PAGES ?? 5);
      for (let page = 1; page <= maxPages; page++) {
        const json = await fetchJson<unknown>(`https://apewisdom.io/api/v1.0/filter/all-stocks/page/${page}`, {
          limiter,
          headers: { "user-agent": "Signal/1.0 (Recherche-Tool)" },
        });
        const parsed = parseApeWisdom(json);
        for (const r of parsed.rows) rows.set(r.ticker, r);
        if (page >= parsed.pages) break;
      }
      await recordMentions([...rows.values()], Date.now());
      snapshot = { at: Date.now(), rows };
      return rows;
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  return {
    id: "apewisdom",
    label: "ApeWisdom (Reddit-Erwähnungen)",
    attribution: { text: "Erwähnungen: ApeWisdom", url: "https://apewisdom.io/" },
    supports: (i: Instrument) => i.region === "US",
    async mentions(i: Instrument): Promise<SocialDay[]> {
      const rows = await load();
      const row = rows.get(i.ticker.replace(".", "-")) ?? rows.get(i.ticker);
      const history = await mentionHistory(i.ticker, 45, Date.now());
      const today = Math.floor(Date.now() / 1000 / DAY_S) * DAY_S;
      const byDay = new Map(history.map((h) => [h.t, h.mentions]));
      // Nicht gelistete Ticker haben heute 0 Erwähnungen (unter der Top-Liste).
      byDay.set(today, row?.mentions ?? 0);
      return [...byDay.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([t, mentions]) => ({ t, mentions, sentiment: null }));
    },
  };
}

/* ================================ Reddit ================================ */
// Nur mit eigenen, freigegebenen OAuth-Zugangsdaten (Reddit Data API Terms,
// 100 Anfragen/Min. je Client-ID). Suche je Wert in ausgewählten Subreddits.

const US_SUBS = "wallstreetbets+stocks+investing+StockMarket";
const DE_SUBS = "mauerstrassenwetten+Finanzen+aktien";

export function redditQuery(i: Instrument): string {
  const name = `"${i.name.replace(/"/g, "")}"`;
  if (i.ticker.length <= 2) return `${name} OR "$${i.ticker}"`;
  return i.region === "DE" ? `${name} OR "$${i.ticker}"` : `"$${i.ticker}" OR ${i.ticker} OR ${name}`;
}

export function createReddit(clientId: string, clientSecret: string, userAgent: string, analyzer: TextAnalyzer) {
  const limiter = getLimiter("reddit", { perMinute: Number(process.env.REDDIT_RPM ?? 90) });
  let token: { value: string; expires: number } | null = null;

  async function auth(): Promise<string> {
    if (token && Date.now() < token.expires) return token.value;
    const json = await fetchJson<{ access_token: string; expires_in: number }>("https://www.reddit.com/api/v1/access_token", {
      limiter,
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": userAgent,
      },
    });
    token = { value: json.access_token, expires: Date.now() + (json.expires_in - 60) * 1000 };
    return token.value;
  }

  const cache = new Map<string, { at: number; posts: RedditPost[] }>();
  async function search(i: Instrument): Promise<RedditPost[]> {
    const hit = cache.get(i.symbol);
    if (hit && Date.now() - hit.at < 20 * 60_000) return hit.posts;
    const subs = i.region === "DE" ? DE_SUBS : US_SUBS;
    const q = encodeURIComponent(redditQuery(i));
    const json = await fetchJson<unknown>(
      `https://oauth.reddit.com/r/${subs}/search?q=${q}&restrict_sr=1&sort=new&t=month&limit=100&raw_json=1`,
      { limiter, headers: { authorization: `Bearer ${await auth()}`, "user-agent": userAgent } },
    );
    const posts = parseRedditListing(json);
    cache.set(i.symbol, { at: Date.now(), posts });
    return posts;
  }

  return {
    id: "reddit",
    label: "Reddit",
    supports: () => true,
    async social(i: Instrument): Promise<{ days: SocialDay[]; sources: { name: string; share: number }[] }> {
      const posts = await search(i);
      const scores = await analyzer.scoreTexts(posts.map((p) => `${p.title} ${p.text}`));
      const today = Math.floor(Date.now() / 1000 / DAY_S);
      const days: SocialDay[] = [];
      for (let k = 30; k >= 0; k--) {
        const day = today - k;
        const idx = posts.map((p, j) => (Math.floor(p.createdAt / 1000 / DAY_S) === day ? j : -1)).filter((j) => j >= 0);
        const weights = idx.map((j) => Math.log10((posts[j]!.score || 0) + 10));
        const wsum = weights.reduce((a, b) => a + b, 0);
        const sentiment = idx.length ? idx.reduce((a, j, n) => a + scores[j]! * weights[n]!, 0) / wsum : null;
        days.push({ t: day * DAY_S, mentions: idx.length, sentiment });
      }
      const bySub = new Map<string, number>();
      for (const p of posts) bySub.set(`r/${p.subreddit}`, (bySub.get(`r/${p.subreddit}`) ?? 0) + 1);
      const total = posts.length || 1;
      const sources = [...bySub.entries()].map(([name, n]) => ({ name, share: n / total })).sort((a, b) => b.share - a.share);
      return { days, sources };
    },
    async discussions(i: Instrument, limit: number): Promise<Discussion[]> {
      const posts = (await search(i)).filter((p) => Date.now() - p.createdAt < 72 * 3_600_000);
      const top = [...posts].sort((a, b) => b.score + b.comments - (a.score + a.comments)).slice(0, limit);
      const scores = await analyzer.scoreTexts(top.map((p) => `${p.title} ${p.text}`));
      return top.map((p, n) => redditToDiscussion(p, scores[n] ?? 0));
    },
  };
}

/* ======================== Zusammengesetzter Provider ======================== */

type Ape = ReturnType<typeof createApeWisdom>;
type Reddit = ReturnType<typeof createReddit>;

/**
 * Social-Daten: Erwähnungszahlen von ApeWisdom (US) bzw. Reddit-Suche,
 * Stimmung und Diskussionen aus Reddit (falls Zugangsdaten vorhanden).
 */
export function createSocialProvider(sources: { ape?: Ape; reddit?: Reddit }): SocialProvider | null {
  const { ape, reddit } = sources;
  if (!ape && !reddit) return null;
  return {
    id: [ape?.id, reddit?.id].filter(Boolean).join("+"),
    label: [ape?.label, reddit?.label].filter(Boolean).join(" + "),
    mock: false,
    attribution: ape?.attribution,
    supports: (i) => Boolean(reddit) || Boolean(ape?.supports(i)),
    async getSocial(i): Promise<SocialData> {
      const redditData = reddit ? await reddit.social(i) : null;
      if (ape?.supports(i)) {
        const daily = await ape.mentions(i);
        // Stimmung aus Reddit auf die ApeWisdom-Tage übertragen
        if (redditData) {
          const sent = new Map(redditData.days.map((d) => [d.t, d.sentiment]));
          for (const d of daily) d.sentiment = sent.get(d.t) ?? null;
        }
        return { daily, hourly: [], sources: redditData?.sources ?? [{ name: "Reddit & 4chan (ApeWisdom)", share: 1 }] };
      }
      return { daily: redditData?.days ?? [], hourly: [], sources: redditData?.sources ?? [] };
    },
    async getDiscussions(i, limit) {
      return reddit ? reddit.discussions(i, limit) : [];
    },
  };
}
