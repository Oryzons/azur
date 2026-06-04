import { PageHeaderSkeleton } from '@/components/skeletons/PageSkeletons';
import { Skeleton } from '@/components/ui/Skeleton';

export function DashboardHomeSkeleton() {
  return (
    <div className="w-full space-y-8">
      <PageHeaderSkeleton />
      <Skeleton className="h-[20rem] w-full" rounded="2xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-72 w-full" rounded="2xl" />
        ))}
      </div>
    </div>
  );
}
