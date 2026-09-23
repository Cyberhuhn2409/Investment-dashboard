import type { Metadata } from "next";
import { ViewTransition } from "react";
import { DataStatusLine, StaleBanner } from "@/components/data-status";
import { DiscoverList } from "@/components/discover/discover-list";
import { PageHeader } from "@/components/shell/page-header";
import type { DiscoverRow } from "@/lib/discover";
import { moveHighlight } from "@/lib/relevance";
import { getSnapshot } from "@/lib/server/market";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Entdecken",
  description: "Relevante Werte filtern nach Größenklasse, Index, Sektor, Region, Signaltyp und Mindest-Score.",
};

function downsample(values: number[], n: number): number[] {
  if (values.length <= n) return values;
  const step = (values.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => values[Math.round(i * step)]!);
}

export default async function DiscoverPage() {
  const snapshot = await getSnapshot();
  const rows: DiscoverRow[] = snapshot.rows.map((r) => ({
    symbol: r.symbol,
    ticker: r.ticker,
    name: r.name,
    sector: r.sector,
    region: r.region,
    exchange: r.exchange,
    currency: r.currency,
    size: r.size,
    index: r.index,
    price: r.price,
    d1: Math.round(r.changePct1D * 100) / 100,
    spark: downsample(r.spark, 16).map((v) => Math.round(v * 100) / 100),
    mentions: r.mentions24h,
    buzz: Math.round(r.buzzChangePct),
    sentiment: r.sentiment,
    score: r.signal.score,
    type: r.signal.type,
    direction: r.signal.direction,
    highlight:
      r.relevant && !r.signal.flagged ? moveHighlight(r.changePct1D, r.moveZ) : (r.signal.highlights[0] ?? ""),
    relevant: r.relevant,
    moveZ: Math.round(r.moveZ * 10) / 10,
  }));
  const relevant = rows.filter((r) => r.relevant).length;

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade" }}
      default="none"
    >
      <div>
        <PageHeader
          title="Entdecken"
          subtitle={
            <span className="flex flex-col gap-0.5">
              <span>
                <span className="tnum font-medium text-accent">{relevant}</span> relevant von{" "}
                <span className="tnum">{rows.length}</span> Werten · sortiert nach Auffälligkeit
              </span>
              <DataStatusLine status={snapshot.status} />
            </span>
          }
        />
        <StaleBanner status={snapshot.status} />
        <DiscoverList rows={rows} />
      </div>
    </ViewTransition>
  );
}
