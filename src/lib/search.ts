import type { Instrument } from "@/config/universe";

export interface SearchEntry {
  symbol: string;
  ticker: string;
  name: string;
  exchange: Instrument["exchange"];
  sector: Instrument["sector"];
  aliases: string[];
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Relevanz eines Eintrags für eine Suchanfrage (0 = kein Treffer). */
export function matchScore(entry: SearchEntry, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const ticker = entry.ticker.toLowerCase();
  const symbol = entry.symbol.toLowerCase();
  const name = normalize(entry.name);
  if (q === ticker || q === symbol) return 100;
  if (name === q) return 95;
  if (ticker.startsWith(q)) return 80 - Math.min(ticker.length - q.length, 10);
  if (name.startsWith(q)) return 75;
  const words = name.split(" ");
  if (words.some((w) => w.startsWith(q))) return 65;
  const aliases = entry.aliases.map(normalize);
  if (aliases.some((a) => a === q)) return 70;
  if (aliases.some((a) => a.startsWith(q) || a.split(" ").some((w) => w.startsWith(q)))) return 55;
  if (q.length >= 3 && name.includes(q)) return 40;
  if (q.length >= 3 && aliases.some((a) => a.includes(q))) return 30;
  return 0;
}

export function searchInstruments(entries: readonly SearchEntry[], query: string, limit = 12): SearchEntry[] {
  return entries
    .map((entry) => ({ entry, score: matchScore(entry, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, "de"))
    .slice(0, limit)
    .map((r) => r.entry);
}

export function toSearchEntries(instruments: readonly Instrument[]): SearchEntry[] {
  return instruments.map(({ symbol, ticker, name, exchange, sector, aliases }) => ({
    symbol,
    ticker,
    name,
    exchange,
    sector,
    aliases,
  }));
}
