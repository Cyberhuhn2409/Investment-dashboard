import { NextResponse } from "next/server";
import { toDiscoverRows } from "@/lib/server/discover-rows";
import { getSnapshot } from "@/lib/server/market";

/** Alle Zeilen für „Entdecken → Alle“ (die Seite selbst liefert nur relevante Werte aus). */
export async function GET() {
  try {
    const snapshot = await getSnapshot();
    return NextResponse.json(
      { rows: toDiscoverRows(snapshot.rows) },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } },
    );
  } catch {
    return NextResponse.json({ error: "Datenquelle nicht erreichbar" }, { status: 502 });
  }
}
