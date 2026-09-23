"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m } from "motion/react";
import { SearchIcon } from "../icons";
import { NAV_ITEMS, isActive, openSearch } from "./nav";
import { NavIcon } from "./nav-icon";

/** Native-artige Tab-Leiste für Mobilgeräte (unter lg). */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Hauptnavigation"
      className="glass hairline-t safe-bottom fixed inset-x-0 bottom-0 z-40 lg:hidden"
      style={{ viewTransitionName: "app-nav" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[3.25rem] flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors ${
                  active ? "text-accent" : "text-fg-2"
                }`}
              >
                <m.span whileTap={{ scale: 0.86 }} className="grid place-items-center">
                  <NavIcon name={item.icon} active={active} size={25} />
                </m.span>
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={openSearch}
            className="flex h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium text-fg-2"
          >
            <m.span whileTap={{ scale: 0.86 }} className="grid place-items-center">
              <SearchIcon size={25} />
            </m.span>
            Suche
          </button>
        </li>
      </ul>
    </nav>
  );
}
