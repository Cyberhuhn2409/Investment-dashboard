export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} style={style} />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="size-10 rounded-[30%]" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-36" />
      </div>
      <Skeleton className="h-7 w-20" />
    </div>
  );
}

export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Screenreader-Hinweis für Ladezustände. */
export function LoadingAnnouncement({ label = "Daten werden geladen" }: { label?: string }) {
  return (
    <p role="status" className="sr-only">
      {label}…
    </p>
  );
}
