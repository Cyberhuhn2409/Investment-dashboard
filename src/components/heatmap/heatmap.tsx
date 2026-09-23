"use client";

import Link from "next/link";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from "d3-hierarchy";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SECTORS, sectorLabel, type SectorId } from "@/config/sectors";
import { formatInteger, formatNumber, formatPercent } from "@/lib/format";
import { heatColor, legendStops, type HeatMetric, type HeatPeriod } from "@/lib/heatmap-colors";
import { instrumentHref } from "@/lib/view-transition";
import { useLiveQuote, useLiveSymbols } from "@/lib/live/hooks";
import { ChevronLeftIcon } from "../icons";
import { useResolvedTheme } from "../shell/theme-toggle";
import { SegmentedControl } from "../ui/segmented";

export interface HeatTile {
  s: string;
  t: string;
  n: string;
  sec: SectorId;
  reg: "US" | "DE";
  cap: number;
  d1: number;
  w1: number;
  m1: number;
  buzz: number;
  sent: number | null;
  score: number;
  /** Größenklasse */
  sz: "mega" | "large" | "mid" | "small";
  /** relevant (1) oder nicht (0) */
  rel: 0 | 1;
}

type Region = "ALL" | "US" | "DE";
type Segment = "large" | "mid" | "small" | "all";

const SEGMENT_MATCH: Record<Segment, (t: HeatTile) => boolean> = {
  large: (t) => t.sz === "mega" || t.sz === "large",
  mid: (t) => t.sz === "mid",
  small: (t) => t.sz === "small",
  all: () => true,
};

/** Höchstens so viele Kacheln erhalten Live-Kurse (die größten). */
const LIVE_TILES = 120;

interface Node {
  name: string;
  tile?: HeatTile;
  children?: Node[];
}

const SECTOR_HEADER = 24;

function tileValue(tile: HeatTile, metric: HeatMetric, period: HeatPeriod): number | null {
  if (metric === "price") return period === "1D" ? tile.d1 : period === "1W" ? tile.w1 : tile.m1;
  if (metric === "buzz") return tile.buzz;
  return tile.sent;
}

function valueLabel(v: number | null, metric: HeatMetric): string {
  if (v === null || !Number.isFinite(v)) return "–";
  if (metric === "sentiment") return formatNumber(v, 2, { sign: true });
  return formatPercent(v, metric === "buzz" ? 0 : Math.abs(v) >= 10 ? 1 : 2);
}

function metricName(metric: HeatMetric, period: HeatPeriod): string {
  if (metric === "price") return `Kursveränderung ${period === "1D" ? "heute" : period === "1W" ? "1 Woche" : "1 Monat"}`;
  if (metric === "buzz") return "Erwähnungen ggü. 30-Tage-Schnitt";
  return "Stimmung (−1 bis +1)";
}

export function Heatmap({ tiles }: { tiles: HeatTile[] }) {
  const [metric, setMetric] = useState<HeatMetric>("price");
  const [period, setPeriod] = useState<HeatPeriod>("1D");
  const [region, setRegion] = useState<Region>("ALL");
  const [segment, setSegment] = useState<Segment>("large");
  const [highlight, setHighlight] = useState(false);
  const [zoom, setZoom] = useState<SectorId | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<{ tile: HeatTile; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const theme = useResolvedTheme();
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const mobile = window.innerWidth < 1024;
      const available = window.innerHeight - (mobile ? 150 : 110) - Math.min(top, 260);
      const h = Math.round(Math.max(mobile ? 460 : 520, Math.min(available, mobile ? w * 1.9 : 820)));
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filtered = useMemo(
    () => tiles.filter((t) => (region === "ALL" || t.reg === region) && SEGMENT_MATCH[segment](t)),
    [tiles, region, segment],
  );
  const relevantCount = useMemo(() => filtered.filter((t) => t.rel).length, [filtered]);

  const layout = useMemo(() => {
    if (!size) return null;
    const sectors = SECTORS.map((sec) => ({
      name: sec.id,
      children: filtered.filter((t) => t.sec === sec.id).map((t) => ({ name: t.s, tile: t })),
    })).filter((s) => s.children.length > 0 && (!zoom || s.name === zoom));
    const root = hierarchy<Node>({ name: "root", children: sectors })
      .sum((d) => d.tile?.cap ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    treemap<Node>()
      .tile(treemapSquarify.ratio(1.2))
      .size([size.w, size.h])
      .paddingOuter(zoom ? 0 : 1)
      .paddingTop((n) => (n.depth === 1 ? SECTOR_HEADER : 0))
      .paddingInner((n) => (n.depth === 0 ? 3 : 1.5))
      .round(true)(root);
    const rect = root as HierarchyRectangularNode<Node>;
    return {
      sectors: rect.children ?? [],
      leaves: rect.leaves().filter((l) => l.data.tile),
    };
  }, [filtered, size, zoom]);

  const onTileHover = useCallback((tile: HeatTile, e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !box.current) return;
    const r = box.current.getBoundingClientRect();
    setHover({ tile, x: e.clientX - r.left, y: e.clientY - r.top });
  }, []);

  const liveOn = metric === "price" && period === "1D";
  const liveSymbols = useMemo(() => {
    if (!liveOn || !layout) return [];
    return layout.leaves
      .filter((l) => l.x1 - l.x0 >= 24 && l.y1 - l.y0 >= 24)
      .sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))
      .slice(0, LIVE_TILES)
      .map((l) => l.data.tile!.s);
  }, [layout, liveOn]);
  useLiveSymbols(liveSymbols);

  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 32, mass: 0.8 };
  const stops = legendStops(metric, theme, period);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 lg:px-0">
        <SegmentedControl
          label="Einfärbung"
          size="sm"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "price", label: "Kurs" },
            { value: "buzz", label: "Buzz" },
            { value: "sentiment", label: "Stimmung" },
          ]}
        />
        {metric === "price" && (
          <SegmentedControl
            label="Zeitraum"
            size="sm"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "1D", label: "1T", ariaLabel: "Heute" },
              { value: "1W", label: "1W", ariaLabel: "1 Woche" },
              { value: "1M", label: "1M", ariaLabel: "1 Monat" },
            ]}
          />
        )}
        <SegmentedControl
          label="Größenklasse"
          size="sm"
          value={segment}
          onChange={(v) => {
            setSegment(v);
            setZoom(null);
          }}
          options={[
            { value: "large", label: "Large", ariaLabel: "Mega und Large Caps" },
            { value: "mid", label: "Mid", ariaLabel: "Mid Caps" },
            { value: "small", label: "Small", ariaLabel: "Small Caps" },
            { value: "all", label: "Alle", ariaLabel: "Alle Größen" },
          ]}
          className="lg:ml-auto"
        />
        <SegmentedControl
          label="Region"
          size="sm"
          value={region}
          onChange={(r) => {
            setRegion(r);
            setZoom(null);
          }}
          options={[
            { value: "ALL", label: "Alle" },
            { value: "US", label: "USA" },
            { value: "DE", label: "DE", ariaLabel: "Deutschland" },
          ]}
        />
        <button
          type="button"
          aria-pressed={highlight}
          onClick={() => setHighlight((h) => !h)}
          className={`press inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-[0.8125rem] font-medium ${
            highlight ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-fg-2 hover:text-fg"
          }`}
        >
          <span aria-hidden="true" className={`size-2 rounded-sm ${highlight ? "bg-accent" : "bg-fg-3"}`} />
          Relevante hervorheben
        </button>
      </div>

      <div className="mt-3 flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 lg:px-0">
        {zoom ? (
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label={`Alle Sektoren – zurück zur Übersicht (aktuell: ${sectorLabel(zoom)})`}
            className="press -ml-1 inline-flex items-center gap-0.5 whitespace-nowrap rounded-lg py-1 pr-2 text-[0.9375rem] font-medium text-accent"
          >
            <ChevronLeftIcon size={20} strokeWidth={2.2} />
            Alle Sektoren
          </button>
        ) : (
          <p className="text-[0.8125rem] text-fg-2">
            <span className="lg:hidden">Sektor antippen = Zoom</span>
            <span className="hidden lg:inline">Sektor anklicken zum Vergrößern · Kachel öffnet Details</span>
          </p>
        )}
        <div className="flex shrink-0 items-center gap-2 text-[0.6875rem] text-fg-2" aria-label={`Legende: ${metricName(metric, period)}`}>
          <span>{stops[0]!.label}</span>
          <span
            className="h-2 w-20 rounded-full"
            style={{ background: `linear-gradient(90deg, ${stops.map((s) => s.color).join(", ")})` }}
            aria-hidden="true"
          />
          <span>{stops[2]!.label}</span>
        </div>
      </div>

      <div
        ref={box}
        className="relative mx-2 mt-2 overflow-hidden rounded-2xl lg:mx-0"
        style={{ height: size?.h ?? 560, contain: "layout paint" }}
        onPointerLeave={() => setHover(null)}
      >
        {!layout && <div className="skeleton absolute inset-0" aria-hidden="true" />}
        {layout && (
          <>
            {layout.sectors.map((sec) => {
              const id = sec.data.name as SectorId;
              const w = sec.x1 - sec.x0;
              if (w < 28) return null;
              return (
                <m.button
                  key={`sec-${id}`}
                  type="button"
                  disabled={zoom !== null}
                  onClick={() => setZoom(id)}
                  initial={false}
                  animate={{ x: sec.x0, y: sec.y0, width: w, opacity: 1 }}
                  transition={spring}
                  className="absolute left-0 top-0 z-10 flex h-6 items-center truncate px-1 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-fg-2 enabled:hover:text-fg"
                  aria-label={zoom ? sectorLabel(id) : `${sectorLabel(id)} vergrößern`}
                >
                  {w > 40 ? sectorLabel(id) : ""}
                </m.button>
              );
            })}
            <AnimatePresence initial={false}>
              {layout.leaves.map((leaf) => {
                const tile = leaf.data.tile!;
                const w = leaf.x1 - leaf.x0;
                const h = leaf.y1 - leaf.y0;
                return (
                  <m.div
                    key={tile.s}
                    initial={{ opacity: 0, x: leaf.x0, y: leaf.y0, width: w, height: h }}
                    animate={{ opacity: 1, x: leaf.x0, y: leaf.y0, width: w, height: h }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={spring}
                    className="absolute left-0 top-0"
                  >
                    <TileView
                      tile={tile}
                      w={w}
                      h={h}
                      metric={metric}
                      period={period}
                      theme={theme}
                      live={liveOn}
                      dim={highlight && !tile.rel}
                      mark={highlight && tile.rel === 1}
                      onZoom={setZoom}
                      onHover={onTileHover}
                    />
                  </m.div>
                );
              })}
            </AnimatePresence>
          </>
        )}
        {hover && (
          <div
            className="pointer-events-none absolute z-30 w-56 rounded-xl border border-line bg-surface/95 p-3 text-[0.8125rem] shadow-xl backdrop-blur"
            style={{
              left: Math.min(hover.x + 14, (size?.w ?? 0) - 232),
              top: Math.min(hover.y + 14, (size?.h ?? 0) - 130),
            }}
            aria-hidden="true"
          >
            <p className="font-semibold">{hover.tile.n}</p>
            <p className="text-fg-2">
              {hover.tile.t} · {sectorLabel(hover.tile.sec)}
            </p>
            <dl className="tnum mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
              <dt className="text-fg-2">Heute</dt>
              <dd className="text-right">{formatPercent(hover.tile.d1)}</dd>
              <dt className="text-fg-2">1 Monat</dt>
              <dd className="text-right">{formatPercent(hover.tile.m1)}</dd>
              <dt className="text-fg-2">Buzz</dt>
              <dd className="text-right">{formatPercent(hover.tile.buzz, 0)}</dd>
              <dt className="text-fg-2">Stimmung</dt>
              <dd className="text-right">{hover.tile.sent === null ? "–" : formatNumber(hover.tile.sent, 2, { sign: true })}</dd>
              <dt className="text-fg-2">Signal</dt>
              <dd className="text-right">{formatInteger(hover.tile.score)}/100</dd>
            </dl>
          </div>
        )}
      </div>
      <p className="mt-3 px-4 text-[0.75rem] text-fg-2 lg:px-0">
        Kachelgröße = Marktkapitalisierung (in USD umgerechnet). Farbe = {metricName(metric, period)}
        {liveOn ? " (live)" : ""}. {filtered.length} Werte, davon {relevantCount} relevant.
      </p>
    </div>
  );
}

interface TileProps {
  tile: HeatTile;
  w: number;
  h: number;
  metric: HeatMetric;
  period: HeatPeriod;
  theme: "dark" | "light";
  live: boolean;
  dim: boolean;
  mark: boolean;
  onZoom: (sector: SectorId) => void;
  onHover: (tile: HeatTile, e: React.PointerEvent) => void;
}

/** Eine Kachel; bei „Kurs heute“ mit Live-Veränderung eingefärbt. */
const TileView = memo(function TileView({ tile, w, h, metric, period, theme, live, dim, mark, onZoom, onHover }: TileProps) {
  const quote = useLiveQuote(live ? tile.s : null);
  const v = live && quote ? quote.cp : tileValue(tile, metric, period);
  const tiny = w < 24 || h < 24;
  const big = w >= 120 && h >= 80;
  const fs = big ? Math.min(22, Math.max(13, Math.sqrt(w * h) / 7)) : 11.5;
  // Nur anzeigen, was vollständig passt (grobe Breitenschätzung der Systemschrift)
  const fits = (text: string, size: number) => text.length * size * 0.8 + 10 <= w;
  const valueText = valueLabel(v, metric);
  const showTicker = !dim && h >= 20 && fits(tile.t, fs);
  const showValue = showTicker && h >= 36 && fits(valueText, fs * 0.82);
  const style: React.CSSProperties = {
    backgroundColor: heatColor(metric, v, theme, period),
    opacity: dim ? 0.28 : 1,
    boxShadow: mark ? "inset 0 0 0 2px var(--accent)" : undefined,
  };
  if (tiny) {
    // Winzige Kacheln (< 24 px) sind keine eigenen Ziele: Tippen vergrößert den Sektor.
    return (
      <div
        aria-hidden="true"
        onClick={() => onZoom(tile.sec)}
        className="h-full w-full cursor-zoom-in rounded-[2px] transition-[background-color,opacity] duration-300"
        style={style}
        data-testid="heatmap-tile"
        data-symbol={tile.s}
      />
    );
  }
  return (
    <Link
      href={instrumentHref(tile.s)}
      transitionTypes={["nav-forward"]}
      aria-label={`${tile.n} (${tile.t}): ${metricName(metric, period)} ${valueLabel(v, metric)}${tile.rel ? ", relevant" : ""}`}
      onPointerMove={(e) => onHover(tile, e)}
      className="flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[3px] text-center text-white transition-[background-color,filter,opacity] duration-300 hover:brightness-110 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white"
      style={style}
      data-testid="heatmap-tile"
      data-symbol={tile.s}
    >
      {showTicker && (
        <span className="max-w-full truncate px-0.5 font-semibold leading-tight" style={{ fontSize: fs }}>
          {tile.t}
        </span>
      )}
      {showValue && (
        <span className="tnum max-w-full truncate px-0.5 leading-tight opacity-90" style={{ fontSize: fs * 0.82 }}>
          {valueText}
        </span>
      )}
    </Link>
  );
});
