"use client";

import { useLayoutEffect } from "react";
import { applyTheme, readThemePreference, resolveTheme } from "@/lib/theme";

/**
 * Wendet das gespeicherte Design an, falls das Inline-Skript im <head> nicht
 * lief – etwa bei Fehler- und 404-Seiten, deren Dokument React im Browser neu
 * aufbaut (per innerHTML eingefügte Skripte werden nicht ausgeführt).
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    const pref = readThemePreference();
    if (document.documentElement.getAttribute("data-theme") !== resolveTheme(pref)) applyTheme(pref);
  }, []);
  return null;
}
