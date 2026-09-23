"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TapeItem } from "@/lib/selectors";
import { LiveChange, LivePrice } from "./live-values";

function Entry({ item, clone = false }: { item: TapeItem; clone?: boolean }) {
  const content = (
    <>
      <span className={`label-mono ${item.href ? "text-accent" : "text-fg"}`}>{item.label}</span>
      <LivePrice
        symbol={item.key}
        price={item.price}
        currency={item.currency ?? undefined}
        plain={item.currency === null}
        className="text-[0.8125rem] text-fg"
      />
      <LiveChange symbol={item.key} price={item.price} changePct={item.changePct} className="text-[0.75rem]" />
    </>
  );
  return (
    <li className="flex shrink-0 items-center border-r border-line">
      {item.href ? (
        <Link
          href={item.href}
          tabIndex={clone ? -1 : undefined}
          aria-label={clone ? undefined : `${item.name} (${item.label})`}
          className="flex h-9 items-center gap-2 px-3.5 hover:bg-surface-2"
          transitionTypes={["nav-forward"]}
        >
          {content}
        </Link>
      ) : (
        <span className="flex h-9 items-center gap-2 px-3.5">{content}</span>
      )}
    </li>
  );
}

/**
 * Laufband mit Live-Kursen (Indizes + relevante Werte). Läuft endlos und
 * pausiert bei Hover/Fokus; bei reduzierter Bewegung horizontal scrollbar.
 */
export function TickerTape({ items, className = "" }: { items: TapeItem[]; className?: string }) {
  // Die Kopie für die Endlosschleife entsteht erst im Browser (kleineres HTML);
  // bis dahin steht das Band still.
  const [running, setRunning] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setRunning(true), 1500);
    return () => window.clearTimeout(id);
  }, []);
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Kursleiste"
      tabIndex={0}
      className={`tape no-scrollbar relative overflow-hidden border-y border-line bg-surface motion-reduce:overflow-x-auto ${className}`}
    >
      <div
        className="tape-track"
        data-running={running ? "" : undefined}
        style={{ "--tape-duration": `${Math.max(40, items.length * 5)}s` } as React.CSSProperties}
      >
        <ul className="flex shrink-0">
          {items.map((item) => (
            <Entry key={item.key} item={item} />
          ))}
        </ul>
        {running && (
          <ul className="tape-clone flex shrink-0" aria-hidden="true">
            {items.map((item) => (
              <Entry key={item.key} item={item} clone />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
