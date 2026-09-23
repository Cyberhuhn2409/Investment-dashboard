import { formatRelative } from "@/lib/format";
import type { NewsItem } from "@/lib/types";
import { ExternalIcon, NewsIcon } from "../icons";

export function NewsList({ items, reference, demo }: { items: NewsItem[]; reference: number; demo: boolean }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-surface px-4 py-8 text-center">
        <NewsIcon size={28} className="mx-auto text-fg-3" />
        <p className="mt-2 font-medium">Keine aktuellen Nachrichten</p>
        <p className="mt-1 text-sm text-fg-2">In den letzten Tagen gab es keine Meldungen zu diesem Wert.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface">
      {items.map((n) => (
        <li key={n.id}>
          <a
            href={n.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="press relative flex gap-3 px-4 py-3.5 hover:bg-surface-2/60"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[0.75rem] text-fg-2">
                <span className="font-medium">{n.source}</span> · {formatRelative(n.publishedAt, reference)}
                {demo && " · Beispiel"}
              </p>
              <p className="mt-1 text-[0.9375rem] font-medium leading-snug">{n.headline}</p>
              {n.summary && <p className="mt-1 line-clamp-2 text-[0.8125rem] text-fg-2">{n.summary}</p>}
            </div>
            <ExternalIcon size={16} className="mt-1 shrink-0 text-fg-3" />
            <span className="sr-only">(öffnet in neuem Tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
