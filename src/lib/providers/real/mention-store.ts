import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Tages-Historie der Erwähnungen. ApeWisdom liefert nur „jetzt“ und „vor
 * 24 Std.“ – für die 30-Tage-Basislinie speichern wir jeden Abruf je UTC-Tag.
 * Persistiert als JSON in DATA_DIR (Standard: .data/); ist das Dateisystem
 * schreibgeschützt (z. B. Serverless), bleibt die Historie im Speicher.
 */
type Store = Record<string, Record<string, number>>;

const DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "mentions.json");
const KEEP_DAYS = 120;

let store: Store | null = null;
let writing: Promise<void> | null = null;
let persist = true;

async function load(): Promise<Store> {
  if (store) return store;
  try {
    store = JSON.parse(await readFile(FILE, "utf8")) as Store;
  } catch {
    store = {};
  }
  return store;
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

async function save(): Promise<void> {
  if (!persist || !store) return;
  if (writing) return writing;
  writing = (async () => {
    try {
      await mkdir(DIR, { recursive: true });
      await writeFile(FILE, JSON.stringify(store), "utf8");
    } catch {
      persist = false; // schreibgeschützt → nur Speicher
    } finally {
      writing = null;
    }
  })();
  return writing;
}

export async function recordMentions(entries: { ticker: string; mentions: number; mentions24hAgo?: number }[], nowMs: number) {
  const s = await load();
  const today = dayKey(nowMs);
  const yesterday = dayKey(nowMs - 86_400_000);
  const cutoff = dayKey(nowMs - KEEP_DAYS * 86_400_000);
  for (const e of entries) {
    const row = (s[e.ticker] ??= {});
    row[today] = e.mentions;
    if (e.mentions24hAgo !== undefined && Number.isFinite(e.mentions24hAgo) && row[yesterday] === undefined) {
      row[yesterday] = e.mentions24hAgo;
    }
    for (const k of Object.keys(row)) if (k < cutoff) delete row[k];
  }
  await save();
}

/** Tageswerte (chronologisch) für die letzten `days` Tage – nur Tage mit Daten. */
export async function mentionHistory(ticker: string, days: number, nowMs: number): Promise<{ t: number; mentions: number }[]> {
  const s = await load();
  const row = s[ticker] ?? {};
  const out: { t: number; mentions: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ms = nowMs - i * 86_400_000;
    const v = row[dayKey(ms)];
    if (v !== undefined) out.push({ t: Math.floor(ms / 86_400_000) * 86_400, mentions: v });
  }
  return out;
}
