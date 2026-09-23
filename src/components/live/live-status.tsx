"use client";

import { formatTimeSeconds } from "@/lib/format";
import { useLiveState } from "@/lib/live/hooks";
import type { LiveState } from "@/lib/live/store";

export function liveStatusText(s: LiveState): { label: string; tone: "live" | "muted" | "warn" } | null {
  switch (s.status) {
    case "live":
      if (s.mode === "delayed") return { label: "Verzögert", tone: "muted" };
      return { label: s.mode === "realtime" ? "Echtzeit" : "Live · simuliert", tone: "live" };
    case "connecting":
      return { label: "Verbinde …", tone: "muted" };
    case "paused":
      return { label: "Pausiert", tone: "muted" };
    case "offline":
      return { label: "Offline", tone: "warn" };
    case "unavailable":
      return { label: "Live nicht verfügbar", tone: "warn" };
    default:
      return null;
  }
}

/** Kompakter Live-Status (Punkt + Text + Zeit des letzten Ticks). */
export function LiveStatus({ className = "" }: { className?: string }) {
  const state = useLiveState();
  const info = liveStatusText(state);
  if (!info) return null;
  const color = info.tone === "live" ? "text-up" : info.tone === "warn" ? "text-warn" : "text-fg-3";
  return (
    <p className={`flex items-center gap-1.5 whitespace-nowrap ${className}`} role="status" aria-live="off">
      <span aria-hidden="true" className={`${info.tone === "live" ? "live-dot" : "size-1.5 rounded-full bg-current"} ${color}`} />
      <span className={`label-mono ${info.tone === "live" ? "text-fg" : "text-fg-2"}`}>{info.label}</span>
      {state.lastTickAt && state.status === "live" && (
        <span className="tnum text-[0.75rem] text-fg-2">
          <span className="sr-only">letzter Kurs </span>
          {formatTimeSeconds(state.lastTickAt)}
        </span>
      )}
    </p>
  );
}
