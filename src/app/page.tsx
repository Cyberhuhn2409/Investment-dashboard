import { ViewTransition } from "react";
import { DataStatusLine, DemoNotice, StaleBanner } from "@/components/data-status";
import { Movers } from "@/components/home/movers";
import { Trending } from "@/components/home/trending";
import { IndexStrip } from "@/components/index-strip";
import { PageHeader } from "@/components/shell/page-header";
import { SignalCard } from "@/components/signal-card";
import { Section } from "@/components/ui/section";
import { formatLongDate } from "@/lib/format";
import { movers, topSignals, trending } from "@/lib/selectors";
import { getSnapshot } from "@/lib/server/market";

export const revalidate = 60;

export default async function HomePage() {
  const snapshot = await getSnapshot();
  const top = topSignals(snapshot.rows, 9);
  const { gainers, losers } = movers(snapshot.rows, 5);
  const hot = trending(snapshot.rows, 8);

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade" }}
      default="none"
    >
      <div>
        <PageHeader
          title="Signal"
          subtitle={
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-fg">{formatLongDate(snapshot.status.asOf)}</span>
              <DataStatusLine status={snapshot.status} />
            </span>
          }
        />
        <StaleBanner status={snapshot.status} />

        <Section title="Märkte" id="maerkte" className="!mt-2">
          <IndexStrip indices={snapshot.indices} />
        </Section>

        <Section
          title="Top-Signale"
          id="top-signale"
          description="Werte, deren Aktivität gerade am stärksten vom Normalen abweicht"
          action={{ href: "/entdecken", label: "Alle" }}
        >
          <ul
            className="no-scrollbar relative flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 xl:grid-cols-3"
            aria-label="Top-Signale"
          >
            {top.map((row) => (
              <li key={row.symbol} className="w-[82%] max-w-[22rem] shrink-0 snap-start sm:w-[20rem] lg:w-auto lg:max-w-none">
                <SignalCard row={row} className="h-full" />
              </li>
            ))}
          </ul>
        </Section>

        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          <Section title="Größte Bewegungen" id="bewegungen" description="Veränderung seit Vortagesschluss">
            <Movers gainers={gainers} losers={losers} />
          </Section>

          <Section
            title="Trending auf Social"
            id="trending"
            description="Meistdiskutiert in 24 Std. · Veränderung ggü. 30-Tage-Schnitt"
          >
            <Trending rows={hot} />
          </Section>
        </div>

        <footer className="mt-10 space-y-3 px-4 lg:px-0">
          <DemoNotice status={snapshot.status} />
          <p className="text-[0.8125rem] text-fg-2">
            Recherche-Werkzeug, keine Anlageberatung. Scores zeigen Auffälligkeiten, keine Kauf- oder Verkaufsempfehlung.
          </p>
        </footer>
      </div>
    </ViewTransition>
  );
}
