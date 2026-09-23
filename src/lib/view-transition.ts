/** Gültiger CSS-Bezeichner für view-transition-name (Punkte in Symbolen sind nicht erlaubt). */
export function sharedName(kind: string, symbol: string): string {
  return `${kind}-${symbol.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function instrumentHref(symbol: string): string {
  return `/aktie/${encodeURIComponent(symbol)}`;
}
