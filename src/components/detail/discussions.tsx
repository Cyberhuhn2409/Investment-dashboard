import { formatInteger, formatRelative } from "@/lib/format";
import { sentimentLabel } from "@/lib/sentiment/lexicon";
import type { Discussion, DiscussionSummary } from "@/lib/types";
import { ChatIcon, ExternalIcon, SparkIcon } from "../icons";

const TONE = {
  positiv: { glyph: "▲", cls: "text-up bg-up-soft" },
  negativ: { glyph: "▼", cls: "text-down bg-down-soft" },
  neutral: { glyph: "◆", cls: "text-fg-2 bg-surface-2" },
} as const;

export function Discussions({
  discussions,
  summary,
  reference,
  demo,
}: {
  discussions: Discussion[];
  summary: DiscussionSummary | null;
  reference: number;
  demo: boolean;
}) {
  if (discussions.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-surface px-4 py-8 text-center">
        <ChatIcon size={28} className="mx-auto text-fg-3" />
        <p className="mt-2 font-medium">Keine Diskussionen gefunden</p>
        <p className="mt-1 text-sm text-fg-2">In den letzten 48 Stunden wurde dieser Wert kaum diskutiert.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {summary && (
        <div className="rounded-[var(--radius-card)] border border-accent/25 bg-accent-soft px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-accent">
            <SparkIcon size={15} />
            {summary.method === "ai" ? "KI-Zusammenfassung" : "Automatische Zusammenfassung"}
          </p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed">{summary.text}</p>
          <p className="mt-1.5 text-[0.75rem] text-fg-2">
            {summary.method === "ai"
              ? "Erstellt mit Claude (Anthropic) aus den unten gezeigten Beiträgen. Kann Fehler enthalten."
              : "Regelbasiert aus Stimmungslexikon und häufigen Begriffen – ohne KI."}
          </p>
        </div>
      )}
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface">
        {discussions.map((d) => {
          const label = sentimentLabel(d.sentiment);
          const tone = TONE[label];
          return (
            <li key={d.id}>
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="press relative block px-4 py-3.5 hover:bg-surface-2/60"
              >
                <div className="flex items-center gap-2 text-[0.75rem] text-fg-2">
                  <span className="font-semibold text-fg">{d.community}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatRelative(d.createdAt, reference)}</span>
                  {demo && (
                    <span className="rounded border border-line-strong px-1 text-[0.625rem] uppercase tracking-wide">
                      Beispiel
                    </span>
                  )}
                  <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-px font-medium ${tone.cls}`}>
                    <span aria-hidden="true" className="text-[0.55rem]">
                      {tone.glyph}
                    </span>
                    {label}
                  </span>
                </div>
                {d.title && <p className="mt-1.5 text-[0.9375rem] font-semibold leading-snug">{d.title}</p>}
                <p className="mt-1 line-clamp-3 text-[0.875rem] leading-snug text-fg-2">{d.snippet}</p>
                <div className="mt-2 flex items-center gap-3 text-[0.75rem] text-fg-2">
                  <span className="tnum">▲ {formatInteger(d.score)}</span>
                  <span className="tnum">{formatInteger(d.comments)} Kommentare</span>
                  <span className="ml-auto inline-flex items-center gap-1 text-accent">
                    {d.source === "reddit" ? "Auf Reddit öffnen" : "Quelle öffnen"}
                    <ExternalIcon size={13} />
                  </span>
                </div>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
