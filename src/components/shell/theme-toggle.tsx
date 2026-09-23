"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, type ResolvedTheme } from "@/lib/theme";
import { MoonIcon, SunIcon } from "../icons";

function subscribe(cb: () => void) {
  window.addEventListener("signal:theme", cb);
  return () => window.removeEventListener("signal:theme", cb);
}

function current(): ResolvedTheme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, current, () => "dark");
}

export function ThemeToggle({ withLabel = false, className = "" }: { withLabel?: boolean; className?: string }) {
  const theme = useResolvedTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = next === "light" ? "Helles Design aktivieren" : "Dunkles Design aktivieren";
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={withLabel ? undefined : label}
      title={label}
      className={`press inline-flex items-center gap-2 rounded-full text-fg-2 hover:text-fg ${
        withLabel ? "px-3 py-2 text-sm" : "size-10 justify-center bg-surface-2"
      } ${className}`}
    >
      {theme === "dark" ? <SunIcon size={20} /> : <MoonIcon size={20} />}
      {withLabel && <span>{next === "light" ? "Hell" : "Dunkel"}</span>}
    </button>
  );
}
