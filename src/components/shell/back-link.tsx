"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChevronLeftIcon } from "../icons";

const KEY = "signal:nav-depth";

function depth(): number {
  try {
    return Number(sessionStorage.getItem(KEY) ?? "0");
  } catch {
    return 0;
  }
}

/** Zählt In-App-Navigationen, damit „Zurück“ die vorige Seite (inkl. Scrollposition) wiederherstellt. */
export function NavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, String(depth() + 1));
    } catch {
      // ignorieren
    }
  }, [pathname]);
  return null;
}

export function BackLink({ fallback = "/", label = "Zurück" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      transitionTypes={["nav-back"]}
      onClick={(e) => {
        if (depth() > 1 && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="press -ml-1 flex items-center gap-0.5 rounded-lg py-2 pl-1 pr-2 text-[1.0625rem] text-accent"
    >
      <ChevronLeftIcon size={24} strokeWidth={2.2} />
      <span>{label}</span>
    </Link>
  );
}
