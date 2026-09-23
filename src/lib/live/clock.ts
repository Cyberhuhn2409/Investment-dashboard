"use client";

import { useSyncExternalStore } from "react";

/**
 * Gemeinsame Uhr für Anzeigen wie Börsenzeiten. `offsetMs` gleicht eine
 * eingefrorene Serverzeit (Demo/Tests) aus. Auf dem Server: null.
 */
let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function tick() {
  now = Math.floor(Date.now() / 1000) * 1000;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    tick();
    timer = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useClock(offsetMs = 0): number | null {
  const t = useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );
  return t ? t + offsetMs : null;
}
