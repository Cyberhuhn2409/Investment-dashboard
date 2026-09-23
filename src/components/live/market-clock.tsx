"use client";

import type { Region } from "@/config/universe";
import { latestSession } from "@/lib/market-time";
import { useClock } from "@/lib/live/clock";

const MARKETS: { region: Region; city: string; short: string; exchange: string; tz: string }[] = [
  { region: "US", city: "New York", short: "NYSE", exchange: "NYSE/Nasdaq", tz: "America/New_York" },
  { region: "DE", city: "Frankfurt", short: "XETRA", exchange: "XETRA", tz: "Europe/Berlin" },
];

const timeFormat = new Map<string, Intl.DateTimeFormat>();
function formatClock(ms: number, tz: string): string {
  let f = timeFormat.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("de-DE", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
    timeFormat.set(tz, f);
  }
  return f.format(ms);
}

/** Börsenuhren mit Status (offen/geschlossen), minütlich aktualisiert. */
export function MarketClocks({
  offsetMs = 0,
  compact = false,
  className = "",
}: {
  offsetMs?: number;
  /** Kurzform für schmale Bildschirme („NYSE 14:30 offen“) */
  compact?: boolean;
  className?: string;
}) {
  const now = useClock(offsetMs);
  return (
    <ul className={`flex items-center gap-4 ${className}`} aria-label="Börsenzeiten">
      {MARKETS.map((mkt) => {
        const open = now !== null && latestSession(mkt.region, now).isOpen;
        return (
          <li key={mkt.region} className="flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden="true" className={`size-1.5 rounded-full ${open ? "bg-up" : "bg-fg-3"}`} />
            <span className="label-mono text-fg-2">{compact ? mkt.short : mkt.city}</span>
            <span className="tnum text-[0.75rem] text-fg">{now === null ? "––:––" : formatClock(now, mkt.tz)}</span>
            <span className={`label-mono ${open ? "text-up" : "text-fg-3"}`}>
              {!compact && <span className="sr-only">{mkt.exchange} </span>}
              {now === null ? "\u00a0" : open ? "offen" : compact ? "zu" : "geschlossen"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
