import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { sectorLabel } from "@/config/sectors";
import { getInstrument, sizeLabel } from "@/config/universe";
import { DataStatusLine, StaleBanner } from "@/components/data-status";
import { Discussions } from "@/components/detail/discussions";
import { KeyStats } from "@/components/detail/key-stats";
import { NewsList } from "@/components/detail/news-list";
import { PricePanel } from "@/components/detail/price-panel";
import { SentimentPanel } from "@/components/detail/sentiment-panel";
import { SignalBreakdown } from "@/components/detail/signal-breakdown";
import { Disclaimer } from "@/components/disclaimer";
import { BackLink } from "@/components/shell/back-link";
import { PageHeader } from "@/components/shell/page-header";
import { Monogram } from "@/components/ui/monogram";
import { Section } from "@/components/ui/section";
import { WatchlistButton } from "@/components/watchlist-button";
import { allSymbols, getInstrumentDetail, providersAreDemo } from "@/lib/server/market";
import { sharedName } from "@/lib/view-transition";

export const revalidate = 60;

export function generateStaticParams() {
  // Demo-Daten sind lokal berechenbar → alle Seiten vorab rendern. Mit echten
  // Providern entstehen Seiten erst bei Bedarf (schont Rate-Limits).
  return providersAreDemo() ? allSymbols().map((symbol) => ({ symbol })) : [];
}

export async function generateMetadata(props: PageProps<"/aktie/[symbol]">): Promise<Metadata> {
  const { symbol } = await props.params;
  const inst = getInstrument(symbol);
  if (!inst) return { title: "Nicht gefunden" };
  return {
    title: `${inst.name} (${inst.ticker})`,
    description: `Kurs, Signal-Score, Social-Stimmung, Diskussionen und Nachrichten zu ${inst.name}. Keine Anlageberatung.`,
  };
}

export default async function InstrumentPage(props: PageProps<"/aktie/[symbol]">) {
  const { symbol } = await props.params;
  const detail = await getInstrumentDetail(decodeURIComponent(symbol));
  if (!detail) notFound();
  const { row, quote, signal, status } = detail;

  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade" }}
      default="none"
    >
      <article>
        <PageHeader
          title={row.name}
          compactTitle={
            <span>
              {row.ticker}
              <span className="ml-1.5 font-normal text-fg-2">{row.exchange}</span>
            </span>
          }
          back={{ href: "/", label: "Zurück" }}
          actions={<WatchlistButton symbol={row.symbol} name={row.name} />}
          hideLargeTitle
        />

        <div className="hidden items-center justify-between pt-8 lg:flex">
          <BackLink fallback="/" label="Zurück" />
          <WatchlistButton symbol={row.symbol} name={row.name} variant="pill" />
        </div>

        <header className="flex items-center gap-3 px-4 pb-4 pt-2 lg:px-0 lg:pt-4">
          <ViewTransition name={sharedName("logo", row.symbol)} share="morph" default="none">
            <Monogram ticker={row.ticker} sector={row.sector} size={52} />
          </ViewTransition>
          <div className="min-w-0">
            <ViewTransition name={sharedName("title", row.symbol)} share="morph" default="none">
              <h1 className="truncate text-[1.5rem] font-bold leading-tight tracking-tight lg:text-[2rem]">{row.name}</h1>
            </ViewTransition>
            <p className="flex flex-wrap items-center gap-x-1.5 text-[0.875rem] text-fg-2">
              <span className="tnum font-medium text-accent">{row.ticker}</span>
              <span aria-hidden="true">·</span>
              <span>{row.exchange}</span>
              <span aria-hidden="true">·</span>
              <span>{sizeLabel(row.size).replace(/s$/, "")}</span>
              {row.index && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{row.index}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{sectorLabel(row.sector)}</span>
            </p>
          </div>
        </header>

        <StaleBanner status={status} />

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="min-w-0">
            <PricePanel
              symbol={row.symbol}
              name={row.name}
              currency={row.currency}
              initial={detail.chart}
              price={quote.price}
              prevClose={quote.prevClose}
              marketOpen={quote.marketOpen}
            />
            <DataStatusLine status={status} className="mt-3 px-4 lg:px-0" />

            <Section title="Signal" id="signal" description="Warum dieser Wert gerade auffällt – transparent aufgeschlüsselt">
              <div className="space-y-3 px-4 lg:px-0">
                <SignalBreakdown signal={signal} />
                <Disclaimer />
              </div>
            </Section>

            <Section
              title="Top-Diskussionen"
              id="diskussionen"
              description="Meistbeachtete Beiträge der letzten 48 Std."
            >
              <div className="px-4 lg:px-0">
                <Discussions
                  discussions={detail.discussions}
                  summary={detail.summary}
                  reference={status.generatedAt}
                  demo={detail.demoParts.social}
                />
              </div>
            </Section>
          </div>

          <div className="min-w-0">
            <Section title="Stimmung" id="stimmung" description="Social-Sentiment der letzten 30 Tage" className="lg:mt-0">
              <div className="px-4 lg:px-0">
                <SentimentPanel
                  days={detail.sentimentDays}
                  breakdown={detail.sentimentBreakdown}
                  sources={detail.socialSources}
                  current={row.sentiment}
                  mentions24h={row.mentions24h}
                  mentionsBaseline={row.mentionsBaseline}
                />
              </div>
            </Section>

            <Section title="Kennzahlen" id="kennzahlen">
              <div className="px-4 lg:px-0">
                <KeyStats row={row} quote={quote} fundamentals={detail.fundamentals} />
              </div>
            </Section>

            <Section title="Nachrichten" id="nachrichten">
              <div className="px-4 lg:px-0">
                <NewsList items={detail.news} reference={status.generatedAt} demo={detail.demoParts.news} />
              </div>
            </Section>
          </div>
        </div>

        <footer className="mt-10 space-y-2 px-4 text-[0.75rem] leading-relaxed text-fg-2 lg:px-0">
          <p>
            Quellen: {[...new Set(status.sources.map((s) => s.label))].join(", ")}.
            {status.sources
              .filter((s, i, all) => s.attribution && all.findIndex((x) => x.attribution?.url === s.attribution?.url) === i)
              .map((s) => (
                <span key={s.id}>
                  {" "}
                  <a href={s.attribution!.url} className="underline underline-offset-2" rel="noopener">
                    {s.attribution!.text}
                  </a>
                </span>
              ))}
          </p>
          <p>
            Charts:{" "}
            <a href="https://www.tradingview.com/" className="underline underline-offset-2" rel="noopener">
              TradingView Lightweight Charts™
            </a>{" "}
            – Copyright © TradingView, Inc.
          </p>
          <p className="font-medium text-fg">Keine Anlageberatung.</p>
        </footer>
      </article>
    </ViewTransition>
  );
}
