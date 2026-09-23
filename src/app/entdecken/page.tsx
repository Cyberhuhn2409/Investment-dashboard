import type { Metadata } from "next";
import { ViewTransition } from "react";
import { DataStatusLine, StaleBanner } from "@/components/data-status";
import { DiscoverList } from "@/components/discover/discover-list";
import { PageHeader } from "@/components/shell/page-header";
import { toDiscoverRows } from "@/lib/server/discover-rows";
import { getSnapshot } from "@/lib/server/market";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Entdecken",
  description: "Relevante Werte filtern nach Größenklasse, Index, Sektor, Region, Signaltyp und Mindest-Score.",
};

export default async function DiscoverPage() {
  const snapshot = await getSnapshot();
  // Nur relevante Werte ins HTML; das komplette Universum lädt die Liste bei Bedarf nach.
  const rows = toDiscoverRows(snapshot.rows.filter((r) => r.relevant));
  const total = snapshot.rows.length;
  const relevant = rows.length;

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
                <span className="tnum">{total}</span> Werten · sortiert nach Auffälligkeit
              </span>
              <DataStatusLine status={snapshot.status} />
            </span>
          }
        />
        <StaleBanner status={snapshot.status} />
        <DiscoverList relevantRows={rows} total={total} />
      </div>
    </ViewTransition>
  );
}
