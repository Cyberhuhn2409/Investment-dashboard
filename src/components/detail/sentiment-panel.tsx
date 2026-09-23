import { formatDate, formatInteger, formatNumber, formatPercent } from "@/lib/format";
import type { SentimentDay } from "@/lib/types";

function SentimentBars({ days }: { days: SentimentDay[] }) {
  const w = 300;
  const h = 72;
  const n = days.length;
  const gap = 2;
  const bw = (w - gap * (n - 1)) / n;
  const mid = h / 2;
  const withData = days.filter((d) => d.sentiment !== null);
  const latest = withData[withData.length - 1];
  return (
    <figure>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[4.5rem] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Stimmung der letzten ${n} Tage, zuletzt ${latest ? formatNumber(latest.sentiment ?? 0, 2, { sign: true }) : "unbekannt"}`}
      >
        <line x1={0} x2={w} y1={mid} y2={mid} stroke="var(--line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {days.map((d, i) => {
          if (d.sentiment === null) return null;
          const v = Math.max(-1, Math.min(1, d.sentiment));
          const bh = Math.max(1.5, Math.abs(v) * (mid - 2));
          return (
            <rect
              key={d.t}
              x={i * (bw + gap)}
              y={v >= 0 ? mid - bh : mid}
              width={bw}
              height={bh}
              rx={1}
              fill={v >= 0.05 ? "var(--up)" : v <= -0.05 ? "var(--down)" : "var(--fg-3)"}
              opacity={i === n - 1 ? 1 : 0.55}
            />
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[0.75rem] text-fg-2">
        <span>{days[0] ? formatDate(days[0].t * 1000) : ""}</span>
        <span>▲ positiv · ▼ negativ</span>
        <span>heute</span>
      </figcaption>
    </figure>
  );
}

export function SentimentPanel({
  days,
  breakdown,
  sources,
  current,
  mentions24h,
  mentionsBaseline,
}: {
  days: SentimentDay[];
  breakdown: { positive: number; neutral: number; negative: number };
  sources: { name: string; share: number }[];
  current: number | null;
  mentions24h: number;
  mentionsBaseline: number;
}) {
  const label =
    current === null ? "keine Daten" : current >= 0.15 ? "positiv" : current <= -0.15 ? "negativ" : "neutral";
  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-4 lg:p-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[0.8125rem] text-fg-2">Stimmung heute</p>
          <p className="tnum mt-0.5 text-[1.375rem] font-semibold">
            {current === null ? "–" : formatNumber(current, 2, { sign: true })}
            <span className="ml-1.5 text-[0.875rem] font-medium text-fg-2">{label}</span>
          </p>
        </div>
        <div>
          <p className="text-[0.8125rem] text-fg-2">Erwähnungen 24 Std.</p>
          <p className="tnum mt-0.5 text-[1.375rem] font-semibold">
            {formatInteger(mentions24h)}
            <span className="ml-1.5 text-[0.875rem] font-medium text-fg-2">Ø {formatInteger(mentionsBaseline)}</span>
          </p>
        </div>
      </div>

      <div className="mt-4">
        <SentimentBars days={days} />
      </div>

      <div className="mt-5">
        <p className="text-[0.8125rem] font-medium">Tonalität der Top-Diskussionen</p>
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
          <div className="bg-up" style={{ width: `${breakdown.positive * 100}%` }} />
          <div className="bg-fg-3" style={{ width: `${breakdown.neutral * 100}%` }} />
          <div className="bg-down" style={{ width: `${breakdown.negative * 100}%` }} />
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-[0.8125rem]">
          <div>
            <dt className="text-fg-2">▲ Positiv</dt>
            <dd className="tnum font-medium">{formatPercent(breakdown.positive * 100, 0, { sign: false })}</dd>
          </div>
          <div>
            <dt className="text-fg-2">◆ Neutral</dt>
            <dd className="tnum font-medium">{formatPercent(breakdown.neutral * 100, 0, { sign: false })}</dd>
          </div>
          <div>
            <dt className="text-fg-2">▼ Negativ</dt>
            <dd className="tnum font-medium">{formatPercent(breakdown.negative * 100, 0, { sign: false })}</dd>
          </div>
        </dl>
      </div>

      {sources.length > 0 && (
        <div className="mt-5">
          <p className="text-[0.8125rem] font-medium">Woher die Erwähnungen kommen</p>
          <ul className="mt-2 space-y-1.5">
            {sources.map((s) => (
              <li key={s.name} className="flex items-center gap-3 text-[0.8125rem]">
                <span className="w-40 shrink-0 truncate text-fg-2">{s.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${s.share * 100}%` }} />
                </span>
                <span className="tnum w-10 text-right">{formatPercent(s.share * 100, 0, { sign: false })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
