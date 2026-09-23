"use client";

import { useLinkStatus } from "next/link";

/**
 * Dezentes Feedback auf dem angetippten Link, solange eine Seite noch vom
 * Server kommt (z. B. Detailseiten, die mit echten Providern erst bei Bedarf
 * gerendert werden). Erscheint erst nach kurzer Verzögerung, damit schnelle
 * Navigationen nicht flackern.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 rounded-[inherit] bg-accent/10 transition-opacity ${
        pending ? "animate-pulse opacity-100 delay-150 duration-300" : "opacity-0 duration-0"
      }`}
    />
  );
}
