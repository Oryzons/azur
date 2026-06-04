import { PageHeaderSkeleton } from '@/components/skeletons/PageSkeletons';
import { Skeleton } from '@/components/ui/Skeleton';

export function FinancesPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-20" rounded="xl" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" rounded="2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56" rounded="2xl" />
        <Skeleton className="h-56" rounded="2xl" />
        <Skeleton className="h-56" rounded="2xl" />
        <Skeleton className="h-56" rounded="2xl" />
      </div>
      <Skeleton className="h-48" rounded="2xl" />
      <Skeleton className="h-64" rounded="2xl" />
    </div>
  );
}
