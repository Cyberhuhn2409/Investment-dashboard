import { NextResponse } from "next/server";
import { getInstrument } from "@/config/universe";
import { getSnapshot } from "@/lib/server/market";

/** Liefert Snapshot-Zeilen für eine Symbolliste (Watchlist). Maximal 60 Symbole. */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("symbols") ?? "";
  const symbols = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 60);
  const valid = symbols.filter((s) => getInstrument(s));
  try {
    const snapshot = await getSnapshot();
    const bySymbol = new Map(snapshot.rows.map((r) => [r.symbol, r]));
    const rows = valid.map((s) => bySymbol.get(getInstrument(s)!.symbol)).filter((r) => r !== undefined);
    return NextResponse.json(
      { rows, status: snapshot.status, unknown: symbols.filter((s) => !getInstrument(s)) },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch {
    return NextResponse.json({ error: "Datenquelle nicht erreichbar" }, { status: 502 });
  }
}
