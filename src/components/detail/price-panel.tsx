"use client";

import type { IChartApi, ISeriesApi, IPriceLine, Time, TickMarkType as TickMarkTypeEnum, UTCTimestamp } from "lightweight-charts";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatInteger, formatNumber, formatPercent, formatShortDateTime, formatDate, TIME_ZONE } from "@/lib/format";
import { CHART_RANGES, CHART_RANGE_LABEL, type ChartData, type ChartRange } from "@/lib/types";
import { AnimatedNumber } from "../ui/animated-number";
import { SegmentedControl } from "../ui/segmented";
import { trendClass } from "../ui/change";
import { AlertIcon, ArrowDownIcon, ArrowUpIcon } from "../icons";

const RANGE_CAPTION: Record<ChartRange, string> = {
  "1D": "Heute",
  "1W": "1 Woche",
  "1M": "1 Monat",
  "6M": "6 Monate",
  "1Y": "1 Jahr",
  "5Y": "5 Jahre",
};

interface Scrub {
  t: number;
  v: number;
  mentions: number | null;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const tickDay = new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" });
const tickMonth = new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, month: "short" });
const tickYear = new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, year: "numeric" });
const tickTime = new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });

export function PricePanel({
  symbol,
  name,
  currency,
  initial,
  price,
  prevClose,
  marketOpen,
}: {
  symbol: string;
  name: string;
  currency: "USD" | "EUR";
  initial: ChartData;
  price: number;
  prevClose: number;
  marketOpen: boolean;
}) {
  const [range, setRange] = useState<ChartRange>(initial.range);
  const [data, setData] = useState<ChartData>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrub, setScrub] = useState<Scrub | null>(null);
  const [showMentions, setShowMentions] = useState(true);
  const cache = useRef(new Map<ChartRange, ChartData>([[initial.range, initial]]));
  const pending = useRef<AbortController | null>(null);

  const loadRange = useCallback(
    async (next: ChartRange, signal?: AbortSignal) => {
      const hit = cache.current.get(next);
      if (hit) return hit;
      const res = await fetch(`/api/chart/${encodeURIComponent(symbol)}?range=${next}`, { signal });
      if (!res.ok) throw new Error(res.status === 429 ? "Zu viele Anfragen – bitte kurz warten." : "Chartdaten konnten nicht geladen werden.");
      const json = (await res.json()) as ChartData;
      cache.current.set(next, json);
      return json;
    },
    [symbol],
  );

  const selectRange = useCallback(
    (next: ChartRange) => {
      setRange(next);
      setScrub(null);
      setError(null);
      pending.current?.abort();
      const hit = cache.current.get(next);
      if (hit) {
        setData(hit);
        setLoading(false);
        return;
      }
      const ctrl = new AbortController();
      pending.current = ctrl;
      setLoading(true);
      loadRange(next, ctrl.signal)
        .then((d) => {
          if (!ctrl.signal.aborted) setData(d);
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") setError((e as Error).message);
        })
        .finally(() => {
          if (pending.current === ctrl) setLoading(false);
        });
    },
    [loadRange],
  );

  useEffect(() => () => pending.current?.abort(), []);

  // Häufige Zeiträume im Leerlauf vorladen
  useEffect(() => {
    const run = () => {
      for (const r of ["1D", "1Y"] as ChartRange[]) loadRange(r).catch(() => {});
    };
    const hasIdle = typeof window.requestIdleCallback === "function";
    const id = hasIdle ? window.requestIdleCallback(run) : window.setTimeout(run, 800);
    return () => {
      if (hasIdle) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, [loadRange]);

  const last = data.points[data.points.length - 1]?.v ?? price;
  const shownValue = scrub ? scrub.v : range === "1D" ? price : last;
  const base = range === "1D" ? prevClose : data.baseline;
  const change = shownValue - base;
  const changePct = base ? (change / base) * 100 : 0;
  const up = change >= 0;
  const formatPrice = useCallback(
    (v: number) => `${formatNumber(v, v >= 10_000 ? 0 : 2)} ${currency === "USD" ? "$" : "€"}`,
    [currency],
  );

  const caption = scrub
    ? data.intraday
      ? formatShortDateTime(scrub.t * 1000)
      : formatDate(scrub.t * 1000)
    : range === "1D"
      ? marketOpen
        ? "Heute · live"
        : "Heute"
      : RANGE_CAPTION[range];

  return (
    <section aria-label={`Kursverlauf ${name}`} className="lg:rounded-[var(--radius-card)] lg:bg-surface lg:p-6">
      <div className="px-4 lg:px-0">
        <p className="text-[2.25rem] font-bold leading-none tracking-tight lg:text-[2.5rem]">
          <span className="sr-only">Kurs: </span>
          <AnimatedNumber value={shownValue} format={formatPrice} immediate={scrub !== null} />
        </p>
        <p className={`mt-2 flex flex-wrap items-center gap-x-2 text-[0.9375rem] font-medium ${trendClass(change)}`}>
          <span className="tnum inline-flex items-center gap-0.5">
            {Math.abs(changePct) >= 0.005 &&
              (up ? <ArrowUpIcon size={15} strokeWidth={2.4} /> : <ArrowDownIcon size={15} strokeWidth={2.4} />)}
            <span className="sr-only">{up ? "gestiegen um" : "gefallen um"} </span>
            {formatNumber(change, 2, { sign: true })} ({formatPercent(changePct, 2)})
          </span>
          <span className="font-normal text-fg-2">{caption}</span>
          {scrub?.mentions != null && showMentions && (
            <span className="font-normal text-accent">· {formatInteger(scrub.mentions)} Erwähnungen</span>
          )}
        </p>
      </div>

      <div className="relative mt-4">
        <ChartCanvas data={data} showMentions={showMentions} baseline={base} onScrub={setScrub} />
        {loading && (
          <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
            <div className="skeleton h-full w-full rounded-none opacity-60" />
          </div>
        )}
        {error && (
          <div role="alert" className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl bg-surface-2 px-4 py-3 text-center text-sm">
            <AlertIcon size={18} className="mx-auto mb-1 text-warn" />
            {error}
            <button type="button" className="ml-2 font-medium text-accent" onClick={() => selectRange(range)}>
              Erneut versuchen
            </button>
          </div>
        )}
        <p className="sr-only" role="status">
          {loading ? "Chart wird geladen" : ""}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-4 lg:px-0">
        <SegmentedControl
          label="Zeitraum"
          value={range}
          onChange={selectRange}
          options={CHART_RANGES.map((r) => ({ value: r, label: CHART_RANGE_LABEL[r], ariaLabel: RANGE_CAPTION[r] }))}
          size="sm"
          className="w-full sm:w-auto"
        />
        <button
          type="button"
          aria-pressed={showMentions}
          onClick={() => setShowMentions((s) => !s)}
          className={`press inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium ${
            showMentions ? "border-accent/40 bg-accent-soft text-accent" : "border-line-strong text-fg-2"
          }`}
        >
          <span aria-hidden="true" className={`size-2 rounded-sm ${showMentions ? "bg-accent" : "bg-fg-3"}`} />
          Erwähnungen einblenden
        </button>
      </div>
      <p className="mt-2 px-4 text-[0.75rem] text-fg-2 lg:px-0">
        Balken: Social-Erwähnungen {data.intraday && range === "1D" ? "pro Stunde" : range === "5Y" ? "pro Woche" : "pro Tag"}{" "}
        · Linie gestrichelt: {range === "1D" ? "Vortagesschluss" : "Startwert des Zeitraums"}
      </p>
    </section>
  );
}

function ChartCanvas({
  data,
  showMentions,
  baseline,
  onScrub,
}: {
  data: ChartData;
  showMentions: boolean;
  baseline: number;
  onScrub: (s: Scrub | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const areaRef = useRef<ISeriesApi<"Area"> | null>(null);
  const barsRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lineRef = useRef<IPriceLine | null>(null);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState(0);
  const dataRef = useRef(data);
  const mentionsByTime = useMemo(() => new Map(data.mentions.map((m) => [m.t, m.v])), [data.mentions]);
  const mentionsRef = useRef(mentionsByTime);
  const onScrubRef = useRef(onScrub);
  // Aktuelle Werte für die (einmalig registrierten) Chart-Callbacks bereitstellen
  useLayoutEffect(() => {
    dataRef.current = data;
    mentionsRef.current = mentionsByTime;
    onScrubRef.current = onScrub;
  });

  // Chart einmalig erzeugen (Bibliothek wird erst hier geladen)
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    import("lightweight-charts").then(({ createChart, AreaSeries, HistogramSeries, CrosshairMode, LineStyle, TickMarkType }) => {
      const el = container.current;
      if (disposed || !el) return;
      const chart = createChart(el, {
        autoSize: true,
        layout: {
          background: { color: "transparent" },
          textColor: cssVar("--fg-2"),
          fontFamily: getComputedStyle(document.body).fontFamily,
          fontSize: 11,
          attributionLogo: true,
        },
        grid: { vertLines: { visible: false }, horzLines: { visible: false } },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.18 } },
        timeScale: {
          borderVisible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
          lockVisibleTimeRangeOnResize: true,
          tickMarkFormatter: (time: Time, type: TickMarkTypeEnum) => {
            const d = new Date((time as number) * 1000);
            if (type === TickMarkType.Year) return tickYear.format(d);
            if (type === TickMarkType.Month) return tickMonth.format(d);
            if (type === TickMarkType.DayOfMonth) return tickDay.format(d);
            return tickTime.format(d);
          },
        },
        crosshair: {
          mode: CrosshairMode.Magnet,
          vertLine: { color: cssVar("--fg-3"), width: 1, style: LineStyle.Solid, labelVisible: false },
          horzLine: { visible: false, labelVisible: false },
        },
        handleScroll: false,
        handleScale: false,
        localization: {
          locale: "de-DE",
          priceFormatter: (p: number) => formatNumber(p, p >= 10_000 ? 0 : 2),
          timeFormatter: (t: Time) =>
            dataRef.current.intraday ? formatShortDateTime((t as number) * 1000) : formatDate((t as number) * 1000),
        },
      });
      const area = chart.addSeries(AreaSeries, {
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerRadius: 5,
        crosshairMarkerBorderWidth: 2,
      });
      const bars = chart.addSeries(HistogramSeries, {
        priceScaleId: "mentions",
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: "volume" },
      });
      chart.priceScale("mentions").applyOptions({ scaleMargins: { top: 0.72, bottom: 0 }, visible: false });

      chart.subscribeCrosshairMove((param) => {
        const point = param.time !== undefined ? param.seriesData.get(area) : undefined;
        if (!point || !("value" in point)) {
          onScrubRef.current(null);
          return;
        }
        const t = param.time as number;
        onScrubRef.current({ t, v: Number(point.value), mentions: mentionsRef.current.get(t) ?? null });
      });

      // Touch-Scrubbing: horizontales Ziehen bewegt das Fadenkreuz sofort
      // (vertikales Scrollen der Seite bleibt über touch-action: pan-y möglich).
      let dragging = false;
      const scrubAt = (clientX: number) => {
        const rect = el.getBoundingClientRect();
        const logical = chart.timeScale().coordinateToLogical(clientX - rect.left);
        if (logical === null) return;
        const pts = dataRef.current.points;
        const idx = Math.max(0, Math.min(pts.length - 1, Math.round(logical)));
        const p = pts[idx];
        if (!p) return;
        chart.setCrosshairPosition(p.v, p.t as UTCTimestamp, area);
        onScrubRef.current({ t: p.t, v: p.v, mentions: mentionsRef.current.get(p.t) ?? null });
      };
      const onDown = (e: PointerEvent) => {
        if (e.pointerType === "mouse") return;
        dragging = true;
        scrubAt(e.clientX);
      };
      const onMove = (e: PointerEvent) => {
        if (dragging) scrubAt(e.clientX);
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        chart.clearCrosshairPosition();
        onScrubRef.current(null);
      };
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
      el.addEventListener("pointerleave", onUp);

      chartRef.current = chart;
      areaRef.current = area;
      barsRef.current = bars;
      setReady(true);
      cleanup = () => {
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
        el.removeEventListener("pointerleave", onUp);
        chart.remove();
      };
    });
    const onTheme = () => setTheme((n) => n + 1);
    window.addEventListener("signal:theme", onTheme);
    return () => {
      disposed = true;
      window.removeEventListener("signal:theme", onTheme);
      cleanup();
      chartRef.current = null;
    };
  }, []);

  // Daten + Farben anwenden
  useEffect(() => {
    const chart = chartRef.current;
    const area = areaRef.current;
    const bars = barsRef.current;
    if (!ready || !chart || !area || !bars) return;
    const lastV = data.points[data.points.length - 1]?.v ?? baseline;
    const up = lastV >= baseline;
    const color = cssVar(up ? "--up" : "--down");
    const accent = cssVar("--accent");
    chart.applyOptions({
      layout: { textColor: cssVar("--fg-2") },
      crosshair: { vertLine: { color: cssVar("--fg-3") } },
      timeScale: { timeVisible: data.intraday, secondsVisible: false },
    });
    area.applyOptions({
      lineColor: color,
      topColor: withAlpha(color, 0.28),
      bottomColor: withAlpha(color, 0),
      crosshairMarkerBackgroundColor: color,
      crosshairMarkerBorderColor: cssVar("--surface"),
    });
    area.setData(data.points.map((p) => ({ time: p.t as UTCTimestamp, value: p.v })));
    bars.setData(
      showMentions
        ? data.mentions.map((m) => ({ time: m.t as UTCTimestamp, value: m.v, color: withAlpha(accent, 0.45) }))
        : [],
    );
    if (lineRef.current) area.removePriceLine(lineRef.current);
    lineRef.current = area.createPriceLine({
      price: baseline,
      color: cssVar("--fg-3"),
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: false,
      title: "",
    });
    chart.timeScale().fitContent();
  }, [data, showMentions, baseline, ready, theme]);

  return (
    <div
      ref={container}
      className="h-[15rem] w-full select-none lg:h-[21rem]"
      style={{ touchAction: "pan-y" }}
      role="img"
      aria-label={`Kursverlauf: ${data.points.length} Datenpunkte. Letzter Wert ${formatNumber(
        data.points[data.points.length - 1]?.v ?? NaN,
        2,
      )}.`}
    >
      {!ready && <div className="skeleton h-full w-full rounded-none" aria-hidden="true" />}
    </div>
  );
}
