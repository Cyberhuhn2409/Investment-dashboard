"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { onOpenSearch } from "../shell/nav";

const SearchDialog = dynamic(() => import("./search-dialog").then((m) => m.SearchDialog), { ssr: false });

/** Globaler Einstieg für die Suche: ⌘K / Strg+K, „/“ oder Such-Buttons. */
export function SearchHost() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Neuer Schlüssel je Öffnen → frischer Zustand (leere Suche, aktuelle Verläufe)
  const [session, setSession] = useState(0);

  useEffect(() => {
    const show = () => {
      setMounted(true);
      setSession((n) => n + 1);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        show();
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    const off = onOpenSearch(show);
    return () => {
      window.removeEventListener("keydown", onKey);
      off();
    };
  }, []);

  if (!mounted) return null;
  return <SearchDialog key={session} open={open} onClose={() => setOpen(false)} />;
}
