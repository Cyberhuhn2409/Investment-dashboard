import { ViewTransition } from "react";
import { DataStatusLine, DemoNotice, StaleBanner } from "@/components/data-status";
import { Movers } from "@/components/home/movers";
import { SegmentRadar } from "@/components/home/segment-radar";
import { Trending } from "@/components/home/trending";
import { IndexStrip } from "@/components/index-strip";
import { LiveStatus } from "@/components/live/live-status";
import { MarketClocks } from "@/components/live/market-clock";
import { TickerTape } from "@/components/live/ticker-tape";
import { PageHeader } from "@/components/shell/page-header";
import { SignalCard } from "@/components/signal-card";
import { Section } from "@/components/ui/section";
import { formatInteger, formatLongDate } from "@/lib/format";
import { moversBySegment, segmentStats, tapeItems, topSignals, trending } from "@/lib/selectors";
import { clockOffsetMs } from "@/lib/server/clock";
import { getSnapshot } from "@/lib/server/market";

export const revalidate = 60;

export default async function HomePage() {
  const snapshot = await getSnapshot();
  const { rows } = snapshot;
  const top = topSignals(rows, 8);
  const hot = trending(rows, 8);
  const segments = segmentStats(rows);
  const relevant = rows.filter((r) => r.relevant).length;

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
              <span className="font-medium text-fg">
                {formatLongDate(snapshot.status.asOf)} ·{" "}
                <span className="tnum text-accent">{formatInteger(relevant)}</span> von{" "}
                <span className="tnum">{formatInteger(rows.length)}</span> Werten relevant
              </span>
              <DataStatusLine status={snapshot.status} />
            </span>
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pb-3 lg:hidden">
          <MarketClocks offsetMs={clockOffsetMs()} compact className="gap-3" />
          <LiveStatus />
        </div>
        <TickerTape items={tapeItems(snapshot.indices, rows)} className="lg:rounded-[var(--radius-card)] lg:border-x" />
        <StaleBanner status={snapshot.status} />

        <Section title="Märkte" id="maerkte" className="!mt-5">
          <IndexStrip indices={snapshot.indices} />
        </Section>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_27rem]">
          <Section
            title="Top-Signale"
            id="top-signale"
            description="Werte, deren Aktivität gerade am stärksten vom Normalen abweicht"
            action={{ href: "/entdecken", label: "Alle relevanten" }}
          >
            <ul
              className="no-scrollbar relative flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 2xl:grid-cols-3"
              aria-label="Top-Signale"
            >
              {top.map((row) => (
                <li key={row.symbol} className="w-[82%] max-w-[22rem] shrink-0 snap-start sm:w-[20rem] lg:w-auto lg:max-w-none">
                  <SignalCard row={row} className="h-full" />
                </li>
              ))}
            </ul>
          </Section>

          <div className="min-w-0">
            <Section
              title="Segment-Radar"
              id="segmente"
              description="Relevante Werte je Größenklasse und Index · Marktbreite heute"
            >
              <SegmentRadar sizes={segments.sizes} indices={segments.indices} />
            </Section>

            <Section
              title="Trending auf Social"
              id="trending"
              description="Meistdiskutiert in 24 Std. · ggü. 30-Tage-Schnitt"
            >
              <Trending rows={hot} />
            </Section>
          </div>
        </div>

        <Section title="Größte Bewegungen" id="bewegungen" description="Veränderung seit Vortagesschluss · live">
          <Movers data={moversBySegment(rows, 6)} />
        </Section>

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
