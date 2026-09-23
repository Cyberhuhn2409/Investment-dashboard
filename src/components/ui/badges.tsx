import { signalTypeLabel, type SignalType } from "@/config/signals";
import type { SignalDirection } from "@/lib/scoring/types";

const TYPE_GLYPH: Record<SignalType, string> = {
  buzz: "◉",
  sentiment: "◐",
  momentum: "↗",
  volume: "▮",
  news: "≡",
};

export function SignalTypeBadge({ type, className = "" }: { type: SignalType; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[0.75rem] font-medium text-accent ${className}`}
    >
      <span aria-hidden="true" className="text-[0.7rem] leading-none">
        {TYPE_GLYPH[type]}
      </span>
      {signalTypeLabel(type)}
    </span>
  );
}

const DIRECTION: Record<SignalDirection, { label: string; glyph: string; cls: string }> = {
  bullish: { label: "Positiv", glyph: "▲", cls: "text-up bg-up-soft" },
  bearish: { label: "Negativ", glyph: "▼", cls: "text-down bg-down-soft" },
  neutral: { label: "Gemischt", glyph: "◆", cls: "text-fg-2 bg-surface-2" },
};

export function directionLabel(direction: SignalDirection): string {
  return DIRECTION[direction].label;
}

export function DirectionBadge({ direction, className = "" }: { direction: SignalDirection; className?: string }) {
  const d = DIRECTION[direction];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.75rem] font-medium ${d.cls} ${className}`}
    >
      <span aria-hidden="true" className="text-[0.6rem] leading-none">
        {d.glyph}
      </span>
      <span>
        <span className="sr-only">Tendenz: </span>
        {d.label}
      </span>
    </span>
  );
}

export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border border-line-strong px-1.5 py-px text-[0.6875rem] font-medium uppercase tracking-wide text-fg-2 ${className}`}
      title="Simulierte Beispieldaten – keine echten Kurse"
    >
      Demo
    </span>
  );
}
