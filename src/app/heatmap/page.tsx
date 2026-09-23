import type { Metadata } from "next";
import { ViewTransition } from "react";
import { DataStatusLine, StaleBanner } from "@/components/data-status";
import { Heatmap, type HeatTile } from "@/components/heatmap/heatmap";
import { PageHeader } from "@/components/shell/page-header";
import { getSnapshot } from "@/lib/server/market";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Heatmap",
  description:
    "Sektor-Heatmap nach Marktkapitalisierung je Größenklasse – eingefärbt nach Kursveränderung (live), Buzz oder Stimmung.",
};

export default async function HeatmapPage() {
  const snapshot = await getSnapshot();
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const tiles: HeatTile[] = snapshot.rows.map((r) => ({
    s: r.symbol,
    t: r.ticker,
    n: r.name,
    sec: r.sector,
    reg: r.region,
    cap: Math.max(0.1, Math.round(r.capUsdBn * 10) / 10),
    d1: r2(r.changePct1D),
    w1: r2(r.changePct1W),
    m1: r2(r.changePct1M),
    buzz: Math.round(r.buzzChangePct),
    sent: r.sentiment === null ? null : r2(r.sentiment),
    score: r.signal.score,
    sz: r.size,
    rel: r.relevant ? 1 : 0,
  }));

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade" }}
      default="none"
    >
      <div>
        <PageHeader title="Heatmap" subtitle={<DataStatusLine status={snapshot.status} />} />
        <StaleBanner status={snapshot.status} />
        <Heatmap tiles={tiles} />
      </div>
    </ViewTransition>
  );
}
