import { InfoIcon } from "./icons";

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <aside
      aria-label="Rechtlicher Hinweis"
      className={`flex gap-3 rounded-2xl border border-line px-4 py-3 text-[0.8125rem] leading-relaxed text-fg-2 ${className}`}
    >
      <InfoIcon size={18} className="mt-0.5 shrink-0" />
      <p>
        <span className="font-semibold text-fg">Keine Anlageberatung.</span> Signal ist ein Recherche-Werkzeug. Scores
        beschreiben, wie ungewöhnlich Aktivität und Kursverlauf gerade sind – nicht, ob ein Kauf oder Verkauf sinnvoll
        ist. Social-Media-Stimmung kann manipuliert sein. Triff Entscheidungen auf Basis eigener Recherche.
      </p>
    </aside>
  );
}
