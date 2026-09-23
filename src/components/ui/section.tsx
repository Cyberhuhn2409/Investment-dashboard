import Link from "next/link";
import { ChevronRightIcon } from "../icons";

export function Section({
  title,
  id,
  action,
  description,
  children,
  className = "",
}: {
  title: string;
  id?: string;
  action?: { href: string; label: string };
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section aria-labelledby={headingId} className={`mt-8 ${className}`}>
      <div className="mb-3 flex items-end justify-between gap-4 px-4 lg:px-0">
        <div>
          <h2 id={headingId} className="text-[1.3125rem] font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[0.875rem] text-fg-2">{description}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="press flex shrink-0 items-center gap-0.5 text-[0.9375rem] font-medium text-accent"
          >
            {action.label}
            <ChevronRightIcon size={16} strokeWidth={2.2} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[var(--radius-card)] bg-surface ${className}`}>{children}</div>;
}
