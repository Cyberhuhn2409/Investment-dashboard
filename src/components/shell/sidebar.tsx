"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark, SearchIcon } from "../icons";
import { NAV_ITEMS, isActive, openSearch } from "./nav";
import { NavIcon } from "./nav-icon";
import { ThemeToggle } from "./theme-toggle";

/** Seitenleiste für Desktop (ab lg). */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex"
      style={{ viewTransitionName: "app-nav-side" }}
    >
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2" aria-label="Signal – Startseite">
        <LogoMark size={30} />
        <span className="text-[1.1875rem] font-semibold tracking-tight">Signal</span>
      </Link>

      <button
        type="button"
        onClick={openSearch}
        className="press mb-6 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-left text-sm text-fg-2 hover:text-fg"
      >
        <SearchIcon size={18} />
        <span className="flex-1">Suchen</span>
        <kbd className="rounded-md border border-line-strong px-1.5 font-sans text-[0.7rem] text-fg-2">⌘K</kbd>
      </button>

      <nav aria-label="Hauptnavigation">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`press flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] font-medium transition-colors ${
                    active ? "bg-accent-soft text-accent" : "text-fg-2 hover:bg-surface-2 hover:text-fg"
                  }`}
                >
                  <NavIcon name={item.icon} active={active} size={22} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto space-y-4 px-1">
        <ThemeToggle withLabel className="-ml-2" />
        <p className="text-xs leading-relaxed text-fg-3">
          Recherche-Werkzeug. Keine Anlageberatung.
          <br />
          Charts:{" "}
          <a href="https://www.tradingview.com/" className="underline underline-offset-2 hover:text-fg-2" rel="noopener">
            TradingView Lightweight Charts™
          </a>
        </p>
      </div>
    </aside>
  );
}
