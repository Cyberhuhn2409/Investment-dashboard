"use client";

import { m } from "motion/react";
import { useId, useRef } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Zugänglicher Name, falls label kein Text ist. */
  ariaLabel?: string;
}

/**
 * iOS-artiges Segmented Control als Radiogruppe (Pfeiltasten wechseln die
 * Auswahl). Der aktive Hintergrund gleitet per Spring-Animation.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className = "",
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (index + dir + options.length) % options.length;
    const opt = options[next];
    if (opt) {
      onChange(opt.value);
      refs.current[next]?.focus();
    }
  };

  const pad = size === "sm" ? "px-2.5 py-1 text-[0.8125rem]" : "px-3 py-1.5 text-[0.875rem]";

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex rounded-[0.8rem] bg-surface-2 p-0.5 ${className}`}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.ariaLabel}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`relative flex-1 whitespace-nowrap rounded-[0.65rem] font-medium transition-colors ${pad} ${
              active ? "text-fg" : "text-fg-2 hover:text-fg"
            }`}
          >
            {active && (
              <m.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[0.65rem] bg-surface-3 shadow-sm light:bg-surface light:shadow-[0_1px_3px_rgb(0_0_0/0.12)]"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
                aria-hidden="true"
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
