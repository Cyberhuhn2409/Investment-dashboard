"use client";

import { animate, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef } from "react";

/**
 * Zahl, die per Feder-Animation zum neuen Wert gleitet. `immediate` setzt den
 * Wert ohne Animation (z. B. beim Scrubben im Chart).
 */
export function AnimatedNumber({
  value,
  format,
  immediate = false,
  className = "",
}: {
  value: number;
  format: (value: number) => string;
  immediate?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current;
    if (immediate || reduce || from === value || !Number.isFinite(from) || !Number.isFinite(value)) {
      el.textContent = format(value);
      shown.current = value;
      return;
    }
    el.textContent = format(from);
    const controls = animate(from, value, {
      type: "spring",
      stiffness: 220,
      damping: 30,
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, immediate, reduce, format]);

  return (
    <span ref={ref} className={`tnum ${className}`}>
      {format(value)}
    </span>
  );
}
