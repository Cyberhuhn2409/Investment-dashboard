import { formatRelative, formatStand } from "@/lib/format";
import type { DataStatus } from "@/lib/types";
import { AlertIcon } from "./icons";
import { DemoBadge } from "./ui/badges";

function marketLine(status: DataStatus): string {
  const us = status.marketOpen.US ? "US geöffnet" : "US geschlossen";
  const de = status.marketOpen.DE ? "XETRA geöffnet" : "XETRA geschlossen";
  return `${us} · ${de}`;
}

/** „Stand: …“-Zeile mit Demo-Kennzeichnung und Marktstatus. */
export function DataStatusLine({ status, className = "" }: { status: DataStatus; className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-fg-2 ${className}`}>
      <time dateTime={new Date(status.asOf).toISOString()} className="tnum">
        {formatStand(status.asOf)}
      </time>
      <span className="inline-flex items-center gap-2">
        {marketLine(status)}
        {status.demo ? (
          <DemoBadge />
        ) : (
          status.sources.some((s) => s.mock) && (
            <span className="rounded-md border border-line-strong px-1.5 py-px text-[0.6875rem] font-medium text-fg-2">
              Teils Demo
            </span>
          )
        )}
      </span>
    </p>
  );
}

/** Hinweis bei veralteten Daten (Provider nicht erreichbar, Rate-Limit o. Ä.). */
export function StaleBanner({ status }: { status: DataStatus }) {
  if (!status.stale && status.notes.length === 0) return null;
  return (
    <div
      role="status"
      className="mx-4 mb-4 flex items-start gap-3 rounded-2xl bg-warn-soft px-4 py-3 text-[0.875rem] lg:mx-0"
    >
      <AlertIcon size={20} className="mt-0.5 shrink-0 text-warn" />
      <div>
        {status.stale && (
          <p>
            <span className="font-semibold">Daten möglicherweise veraltet.</span>{" "}
            Letzte Aktualisierung {formatRelative(status.asOf, status.generatedAt)} ({formatStand(status.asOf)}). Die
            Datenquelle antwortet gerade nicht – wir zeigen den letzten bekannten Stand.
          </p>
        )}
        {status.notes.map((n) => (
          <p key={n} className="mt-1 text-fg-2 first:mt-0">
            {n}
          </p>
        ))}
      </div>
    </div>
  );
}

export function DemoNotice({ status }: { status: DataStatus }) {
  if (!status.demo) return null;
  return (
    <p className="text-[0.8125rem] leading-relaxed text-fg-2">
      <span className="font-medium text-fg">Demo-Modus:</span> Kurse, Erwähnungen, Diskussionen und Nachrichten sind
      deterministisch simulierte Beispieldaten. Mit API-Schlüsseln in <code className="font-mono text-[0.75rem]">.env</code>{" "}
      nutzt Signal echte Quellen.
    </p>
  );
}
