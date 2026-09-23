import { LoadingAnnouncement, Skeleton, SkeletonList } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="px-4 pt-14 lg:px-0 lg:pt-10" aria-busy="true">
      <LoadingAnnouncement />
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-3 h-4 w-64" />
      <div className="mt-8 flex gap-3 overflow-hidden">
        <Skeleton className="h-24 min-w-[10.5rem] flex-1 rounded-[var(--radius-card)]" />
        <Skeleton className="h-24 min-w-[10.5rem] flex-1 rounded-[var(--radius-card)]" />
        <Skeleton className="hidden h-24 flex-1 rounded-[var(--radius-card)] sm:block" />
      </div>
      <Skeleton className="mt-8 h-6 w-40" />
      <div className="mt-3">
        <SkeletonList rows={5} />
      </div>
    </div>
  );
}
