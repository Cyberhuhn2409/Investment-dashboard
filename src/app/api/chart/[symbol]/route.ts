import { NextResponse } from "next/server";
import { RateLimitError } from "@/lib/server/rate-limit";
import { getChart } from "@/lib/server/market";
import { CHART_RANGES, type ChartRange } from "@/lib/types";

export async function GET(request: Request, ctx: RouteContext<"/api/chart/[symbol]">) {
  const { symbol } = await ctx.params;
  const range = new URL(request.url).searchParams.get("range") ?? "1M";
  if (!(CHART_RANGES as readonly string[]).includes(range)) {
    return NextResponse.json({ error: "Unbekannter Zeitraum" }, { status: 400 });
  }
  try {
    const data = await getChart(decodeURIComponent(symbol), range as ChartRange);
    if (!data) return NextResponse.json({ error: "Unbekanntes Symbol" }, { status: 404 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Rate-Limit des Datenanbieters erreicht" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(error.retryAfterMs / 1000)) } },
      );
    }
    return NextResponse.json({ error: "Datenquelle nicht erreichbar" }, { status: 502 });
  }
}
