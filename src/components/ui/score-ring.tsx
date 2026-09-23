import { SIGNAL_CONFIG } from "@/config/signals";

export function scoreTone(score: number): { stroke: string; text: string; label: string } {
  if (score >= SIGNAL_CONFIG.thresholds.strong) return { stroke: "var(--accent)", text: "text-accent", label: "stark" };
  if (score >= SIGNAL_CONFIG.thresholds.flagged) return { stroke: "var(--accent)", text: "text-accent", label: "markiert" };
  if (score >= 35) return { stroke: "var(--fg-2)", text: "text-fg", label: "moderat" };
  return { stroke: "var(--fg-3)", text: "text-fg-2", label: "schwach" };
}

/** Ring mit Score 0–100. Text + Ring, damit Farbe nicht das einzige Merkmal ist. */
export function ScoreRing({
  score,
  size = 44,
  stroke = 4,
  showLabel = false,
  className = "",
}: {
  score: number;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = scoreTone(score);
  const offset = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div
      className={`relative inline-grid shrink-0 place-items-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Signal-Score ${score} von 100 (${tone.label})`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        aria-hidden="true"
        className={`tnum absolute inset-0 grid place-items-center font-semibold ${tone.text}`}
        style={{ fontSize: Math.round(size * 0.34) }}
      >
        {score}
      </span>
      {showLabel && <span className="sr-only">{tone.label}</span>}
    </div>
  );
}
