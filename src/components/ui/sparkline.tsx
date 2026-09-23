import { useId } from "react";

/**
 * Leichtgewichtige SVG-Sparkline (serverseitig gerendert, kein JS).
 * Farbe folgt der Richtung Start→Ende; optional mit Referenzlinie.
 */
export function Sparkline({
  values,
  width = 96,
  height = 32,
  className = "",
  area = true,
  baseline,
  strokeWidth = 1.6,
  label,
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  className?: string;
  area?: boolean;
  baseline?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden="true" />;
  }
  const ref = baseline ?? clean[0]!;
  const min = Math.min(...clean, ref);
  const max = Math.max(...clean, ref);
  const span = max - min || 1;
  const pad = strokeWidth;
  const x = (i: number) => (i / (clean.length - 1)) * (width - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const d = clean.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const last = clean[clean.length - 1]!;
  const up = last >= ref;
  const color = up ? "var(--up)" : "var(--down)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      preserveAspectRatio="none"
    >
      {area && (
        <>
          <defs>
            <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d}L${x(clean.length - 1).toFixed(1)} ${height}L${x(0).toFixed(1)} ${height}Z`} fill={`url(#g${id})`} />
        </>
      )}
      {baseline !== undefined && (
        <line
          x1={0}
          x2={width}
          y1={y(ref)}
          y2={y(ref)}
          stroke="var(--fg-3)"
          strokeOpacity="0.5"
          strokeDasharray="2 3"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
