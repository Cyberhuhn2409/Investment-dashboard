import type { Metadata } from "next";
import { ViewTransition } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { WatchlistView } from "@/components/watchlist/watchlist-view";
import { topSignals } from "@/lib/selectors";
import { getSnapshot } from "@/lib/server/market";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Deine lokal gespeicherte Watchlist mit Kursen und Signalen.",
};

export default async function WatchlistPage() {
  const snapshot = await getSnapshot();
  const suggestions = topSignals(snapshot.rows, 4, 1);

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade" }}
      default="none"
    >
      <div>
        <PageHeader title="Watchlist" subtitle="Nur auf diesem Gerät gespeichert" />
        <WatchlistView suggestions={suggestions} />
      </div>
    </ViewTransition>
  );
}
