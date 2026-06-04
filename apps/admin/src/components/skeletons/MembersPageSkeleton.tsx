import { PageHeaderSkeleton } from '@/components/skeletons/PageSkeletons';
import { Skeleton } from '@/components/ui/Skeleton';

export function MembersPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-20" rounded="lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-4">
          <Skeleton className="h-10 w-full" rounded="xl" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" rounded="xl" />
          ))}
        </div>
        <div className="lg:col-span-8">
          <Skeleton className="h-[28rem] w-full" rounded="2xl" />
        </div>
      </div>
    </div>
  );
}
