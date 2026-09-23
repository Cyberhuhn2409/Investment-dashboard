import Link from "next/link";
import { ChevronRightIcon } from "../icons";

/**
 * Abschnitt im Terminal-Stil: kleine Monospace-Überschrift mit Akzentbalken,
 * optional Beschreibung und Link rechts.
 */
export function Section({
  title,
  id,
  action,
  description,
  meta,
  children,
  className = "",
}: {
  title: string;
  id?: string;
  action?: { href: string; label: string };
  description?: React.ReactNode;
  /** Zusatz rechts neben der Überschrift (z. B. Live-Status) */
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section aria-labelledby={headingId} className={`mt-7 ${className}`}>
      <div className="mb-2.5 flex items-end justify-between gap-4 px-4 lg:px-0">
        <div className="min-w-0">
          <h2 id={headingId} className="flex items-center gap-2 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-fg">
            <span aria-hidden="true" className="h-3.5 w-[3px] rounded-full bg-accent" />
            <span className="font-mono">{title}</span>
          </h2>
          {description && <p className="mt-1 text-[0.8125rem] leading-snug text-fg-2">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {meta}
          {action && (
            <Link href={action.href} className="press flex items-center gap-0.5 text-[0.875rem] font-medium text-accent">
              {action.label}
              <ChevronRightIcon size={16} strokeWidth={2.2} />
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>;
}
