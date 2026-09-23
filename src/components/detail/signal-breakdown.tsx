import { COMPONENT_META, SIGNAL_CONFIG } from "@/config/signals";
import { formatNumber } from "@/lib/format";
import type { Signal } from "@/lib/scoring/types";
import { DirectionBadge, SignalTypeBadge } from "../ui/badges";
import { ScoreRing, scoreTone } from "../ui/score-ring";

const CONFIDENCE_TEXT = {
  hoch: "Datenbasis solide",
  mittel: "Datenbasis mittel",
  niedrig: "Datenbasis dünn",
} as const;

export function SignalBreakdown({ signal }: { signal: Signal }) {
  const tone = scoreTone(signal.score);
  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-4 lg:p-6">
      <div className="flex items-center gap-4">
        <ScoreRing score={signal.score} size={72} stroke={6} />
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium uppercase tracking-wide text-fg-2">
            Signal-Score · {tone.label}
          </p>
          <p className="mt-0.5 text-[1.125rem] font-semibold leading-snug">{signal.headline}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <SignalTypeBadge type={signal.type} />
            <DirectionBadge direction={signal.direction} />
            <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[0.75rem] font-medium text-fg-2">
              {CONFIDENCE_TEXT[signal.confidence]}
            </span>
          </div>
        </div>
      </div>

      <h3 className="mt-6 text-[1rem] font-semibold">Warum {signal.flagged ? "markiert" : "dieser Score"}?</h3>
      <ul className="mt-2 space-y-2">
        {signal.reasons.map((r) => (
          <li key={r} className="flex gap-2.5 text-[0.9375rem] leading-snug">
            <span aria-hidden="true" className="mt-[0.45em] size-1.5 shrink-0 rounded-full bg-accent" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
      {signal.caveats.length > 0 && (
        <ul className="mt-3 space-y-1">
          {signal.caveats.map((c) => (
            <li key={c} className="text-[0.8125rem] text-fg-2">
              Hinweis: {c}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 text-[1rem] font-semibold">So setzt sich der Score zusammen</h3>
      <p className="mt-1 text-[0.8125rem] text-fg-2">
        Jeder Faktor wird auf 0–100 normiert und gewichtet. Summe der Beiträge = Score {signal.score}.
      </p>
      <ul className="mt-3 divide-y divide-line">
        {signal.components.map((c) => (
          <li key={c.key} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[0.9375rem] font-medium">
                {c.label}
                <span className="ml-2 text-[0.75rem] font-normal text-fg-2">
                  Gewicht {formatNumber(c.weight * 100, 0)}&nbsp;%
                </span>
              </p>
              <p className="tnum shrink-0 text-[0.9375rem] font-semibold">
                {c.available ? `+${formatNumber(c.points, 1)}` : "–"}
                <span className="ml-1 text-[0.75rem] font-normal text-fg-2">Pkt.</span>
              </p>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
              role="meter"
              aria-label={`${c.label}: Teilscore`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(c.score)}
              aria-valuetext={`${Math.round(c.score)} von 100`}
            >
              <div
                className={`h-full rounded-full ${c.score >= SIGNAL_CONFIG.thresholds.reasonMinScore ? "bg-accent" : "bg-fg-3"}`}
                style={{ width: `${Math.max(c.available ? 2 : 0, c.score)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[0.8125rem] leading-snug text-fg-2">
              <span className="tnum font-medium text-fg">{Math.round(c.score)}/100</span> · {c.detail}
            </p>
          </li>
        ))}
      </ul>
      <details className="group mt-2 rounded-xl bg-surface-2 px-4 py-3 text-[0.8125rem] text-fg-2">
        <summary className="cursor-pointer select-none font-medium text-fg marker:content-none">
          <span className="inline-flex items-center gap-1">
            Methode im Detail
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">
              ›
            </span>
          </span>
        </summary>
        <ul className="mt-2 space-y-1.5 leading-relaxed">
          {signal.components.map((c) => (
            <li key={c.key}>
              <span className="font-medium text-fg">{COMPONENT_META[c.key].label}:</span> {COMPONENT_META[c.key].description}
            </li>
          ))}
          <li>
            Ab {SIGNAL_CONFIG.thresholds.flagged} Punkten gilt ein Wert als markiert. Die Richtung (positiv/negativ) ergibt
            sich aus Stimmung, Stimmungswechsel und Kursmomentum. Fehlen Daten, wird deren Gewicht auf die übrigen Faktoren
            verteilt.
          </li>
        </ul>
      </details>
    </div>
  );
}
