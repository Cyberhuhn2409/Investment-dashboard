"use client";

import { AnimatePresence, m } from "motion/react";
import { useHydrated, useWatchlist } from "@/lib/watchlist";
import { StarIcon } from "./icons";

export function WatchlistButton({ symbol, name, variant = "icon" }: { symbol: string; name: string; variant?: "icon" | "pill" }) {
  const { has, toggle } = useWatchlist();
  const hydrated = useHydrated();
  const active = hydrated && has(symbol);
  const label = active ? `${name} von der Watchlist entfernen` : `${name} zur Watchlist hinzufügen`;

  return (
    <button
      type="button"
      onClick={() => toggle(symbol)}
      aria-pressed={active}
      aria-label={variant === "icon" ? label : undefined}
      title={label}
      data-testid="watchlist-toggle"
      className={
        variant === "icon"
          ? `press grid size-10 place-items-center rounded-full ${active ? "bg-accent-soft text-accent" : "bg-surface-2 text-fg-2"}`
          : `press inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.9375rem] font-medium ${
              active ? "bg-accent-soft text-accent" : "bg-accent text-on-accent"
            }`
      }
    >
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          key={active ? "on" : "off"}
          initial={{ scale: 0.4, rotate: -30, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 22 }}
          className="grid place-items-center"
        >
          <StarIcon size={20} filled={active} />
        </m.span>
      </AnimatePresence>
      {variant === "pill" && <span>{active ? "Auf der Watchlist" : "Zur Watchlist"}</span>}
      <span className="sr-only" aria-live="polite">
        {hydrated ? (active ? "Auf der Watchlist" : "") : ""}
      </span>
    </button>
  );
}
