import { LoadingAnnouncement, Skeleton, SkeletonList } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="px-4 pt-14 lg:px-0 lg:pt-16" aria-busy="true">
      <LoadingAnnouncement label="Detailseite wird geladen" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-[52px] rounded-[30%]" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-3 h-4 w-32" />
          <Skeleton className="mt-5 h-[15rem] w-full rounded-2xl lg:h-[21rem]" />
          <Skeleton className="mt-3 h-8 w-72" />
          <Skeleton className="mt-8 h-64 w-full rounded-[var(--radius-card)]" />
        </div>
        <div className="mt-8 space-y-4 lg:mt-0">
          <Skeleton className="h-56 w-full rounded-[var(--radius-card)]" />
          <SkeletonList rows={3} />
        </div>
      </div>
    </div>
  );
}
