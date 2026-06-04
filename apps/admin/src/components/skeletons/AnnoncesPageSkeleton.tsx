import { PageHeaderSkeleton } from '@/components/skeletons/PageSkeletons';
import { Skeleton } from '@/components/ui/Skeleton';

export function AnnoncesPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-5">
        <Skeleton className="h-4 w-64" rounded="lg" />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-16" rounded="xl" />
          <Skeleton className="h-16" rounded="xl" />
          <Skeleton className="h-16" rounded="xl" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-4">
          <Skeleton className="h-10 w-full" rounded="xl" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" rounded="lg" />
            <Skeleton className="h-8 w-20" rounded="lg" />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[4.5rem] w-full" rounded="xl" />
          ))}
        </div>
        <div className="lg:col-span-8">
          <Skeleton className="h-[28rem] w-full" rounded="2xl" />
        </div>
      </div>
    </div>
  );
}
