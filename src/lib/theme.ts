export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "signal:theme";
export const THEME_COLORS: Record<ResolvedTheme, string> = { dark: "#000000", light: "#f2f2f7" };

/**
 * Läuft synchron im <head>, bevor der Browser zeichnet – verhindert ein
 * Aufblitzen des falschen Themes. Standard ist Dunkel.
 */
export const THEME_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var p=localStorage.getItem(k);var r=p==="light"||p==="dark"?p:(p==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):"dark");var d=document.documentElement;d.setAttribute("data-theme",r);d.style.colorScheme=r;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",r==="light"?${JSON.stringify(THEME_COLORS.light)}:${JSON.stringify(THEME_COLORS.dark)});}catch(e){}})();`;

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return pref;
}

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(pref: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(pref);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Speicher nicht verfügbar (privater Modus) – Theme gilt nur für diese Sitzung.
  }
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[resolved]);
  window.dispatchEvent(new CustomEvent("signal:theme", { detail: resolved }));
  return resolved;
}
