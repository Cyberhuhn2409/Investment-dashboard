"use client";

import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "../icons";
import { BackLink } from "./back-link";
import { openSearch } from "./nav";
import { ThemeToggle } from "./theme-toggle";

/**
 * iOS-typischer Seitenkopf: großer Titel, der beim Scrollen in eine kompakte,
 * durchscheinende Leiste übergeht. Auf Desktop bleibt nur der große Titel.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  compactTitle,
  hideLargeTitle = false,
}: {
  title: string;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  compactTitle?: React.ReactNode;
  hideLargeTitle?: boolean;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry?.isIntersecting), {
      rootMargin: "-56px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div
        className={`safe-top sticky top-0 z-30 transition-[background-color,box-shadow] duration-200 lg:hidden ${
          scrolled ? "glass hairline-b" : "bg-bg"
        }`}
      >
        <div className="flex h-12 items-center gap-2 px-2">
          <div className="flex min-w-0 flex-1 items-center">
            {back ? <BackLink fallback={back.href} label={back.label} /> : null}
          </div>
          <div
            className={`min-w-0 max-w-[55%] truncate text-center text-[1.0625rem] font-semibold transition-opacity duration-200 ${
              scrolled || hideLargeTitle ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={!(scrolled || hideLargeTitle)}
          >
            {compactTitle ?? title}
          </div>
          <div className="flex flex-1 items-center justify-end gap-1.5">
            {actions}
            {!back && (
              <>
                <button
                  type="button"
                  onClick={openSearch}
                  aria-label="Suchen"
                  className="press grid size-10 place-items-center rounded-full bg-surface-2 text-fg-2"
                >
                  <SearchIcon size={19} />
                </button>
                <ThemeToggle />
              </>
            )}
          </div>
        </div>
      </div>

      {!hideLargeTitle && (
        <header className="px-4 pb-4 pt-1 lg:flex lg:items-end lg:justify-between lg:px-0 lg:pb-6 lg:pt-10">
          <div>
            <h1 className="text-[2.125rem] font-bold leading-tight tracking-tight lg:text-[2.5rem]">{title}</h1>
            {subtitle && <div className="mt-1 text-[0.9375rem] text-fg-2">{subtitle}</div>}
          </div>
          {actions && <div className="hidden items-center gap-2 lg:flex">{actions}</div>}
        </header>
      )}
      <div ref={sentinel} aria-hidden="true" className="h-0" />
    </>
  );
}
