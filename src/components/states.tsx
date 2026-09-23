"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertIcon, RefreshIcon, SearchIcon } from "./icons";
import { openSearch } from "./shell/nav";

/** Fehlerzustand für error.tsx-Grenzen (Daten nicht ladbar). */
export function ErrorState({
  error,
  retry,
  title = "Daten konnten nicht geladen werden",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  title?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="grid min-h-[60dvh] place-items-center px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-warn-soft text-warn">
          <AlertIcon size={30} />
        </div>
        <h1 className="text-[1.5rem] font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-fg-2">
          Die Datenquelle antwortet gerade nicht oder das Anfragelimit ist erreicht. Das passiert bei kostenlosen
          Datenanbietern gelegentlich – meist hilft ein erneuter Versuch in wenigen Sekunden.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={retry}
            className="press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-on-accent"
          >
            <RefreshIcon size={18} />
            Erneut versuchen
          </button>
          <Link href="/" className="press inline-flex items-center rounded-full bg-surface-2 px-5 py-2.5 font-medium">
            Zur Startseite
          </Link>
        </div>
        {error.digest && <p className="mt-4 text-xs text-fg-3">Fehler-ID: {error.digest}</p>}
      </div>
    </div>
  );
}

export function NotFoundState({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-surface-2 text-fg-2">
          <SearchIcon size={30} />
        </div>
        <h1 className="text-[1.5rem] font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-fg-2">{text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={openSearch}
            className="press inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-on-accent"
          >
            <SearchIcon size={18} />
            Suche öffnen
          </button>
          <Link href="/entdecken" className="press inline-flex items-center rounded-full bg-surface-2 px-5 py-2.5 font-medium">
            Signale entdecken
          </Link>
        </div>
      </div>
    </div>
  );
}
