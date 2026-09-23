import type { Metadata } from "next";
import { ViewTransition } from "react";
import { DataStatusLine, StaleBanner } from "@/components/data-status";
import { DiscoverList } from "@/components/discover/discover-list";
import { PageHeader } from "@/components/shell/page-header";
import type { DiscoverRow } from "@/lib/discover";
import { getSnapshot } from "@/lib/server/market";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Entdecken",
  description: "Alle Signale filtern nach Sektor, Region, Signaltyp und Mindest-Score.",
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
    price: r.price,
    d1: Math.round(r.changePct1D * 100) / 100,
    spark: downsample(r.spark, 22).map((v) => Math.round(v * 100) / 100),
    mentions: r.mentions24h,
    buzz: Math.round(r.buzzChangePct),
    sentiment: r.sentiment,
    score: r.signal.score,
    type: r.signal.type,
    direction: r.signal.direction,
    highlight: r.signal.highlights[0] ?? "",
  }));
  const flagged = snapshot.rows.filter((r) => r.signal.flagged).length;

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
                {rows.length} Werte · <span className="font-medium text-accent">{flagged} markiert</span> (Score ≥ 60)
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
