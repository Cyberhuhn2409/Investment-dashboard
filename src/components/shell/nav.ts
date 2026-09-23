export const NAV_ITEMS = [
  { href: "/", label: "Start", icon: "home" },
  { href: "/heatmap", label: "Heatmap", icon: "grid" },
  { href: "/entdecken", label: "Entdecken", icon: "compass" },
  { href: "/watchlist", label: "Watchlist", icon: "star" },
] as const;

export type NavIcon = (typeof NAV_ITEMS)[number]["icon"];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SEARCH_EVENT = "signal:open-search";

export function openSearch(): void {
  window.dispatchEvent(new Event(SEARCH_EVENT));
}

export function onOpenSearch(cb: () => void): () => void {
  window.addEventListener(SEARCH_EVENT, cb);
  return () => window.removeEventListener(SEARCH_EVENT, cb);
}
