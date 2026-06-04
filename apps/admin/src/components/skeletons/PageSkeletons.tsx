import { Skeleton } from '@/components/ui/Skeleton';

export function PageHeaderSkeleton(props: Readonly<{ subtitle?: boolean }>) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-56 max-w-full" rounded="xl" />
      {props.subtitle !== false ? <Skeleton className="h-4 w-96 max-w-full" rounded="lg" /> : null}
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 shrink-0" rounded="2xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" rounded="lg" />
            <Skeleton className="h-3 w-48 max-w-full" rounded="md" />
          </div>
        </div>
        <Skeleton className="h-9 w-40" rounded="xl" />
      </div>
      <Skeleton className="mt-5 h-10 w-36" rounded="xl" />
      <Skeleton className="mt-4 h-3 w-56" rounded="md" />
    </section>
  );
}

export function CalendarPlanningSkeleton(props: Readonly<{ rows?: number }>) {
  const n = props.rows ?? 6;
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
      <div className="flex border-b border-zinc-100">
        <Skeleton className="m-3 h-10 w-36 shrink-0" rounded="lg" />
        <div className="flex flex-1 gap-1 border-l border-zinc-100 p-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-8 flex-1" rounded="md" />
          ))}
        </div>
      </div>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex border-b border-zinc-50 last:border-0">
          <div className="flex w-44 shrink-0 items-center gap-2 border-r border-zinc-100 p-3">
            <Skeleton className="h-9 w-9" rounded="full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-full" rounded="md" />
              <Skeleton className="h-2.5 w-[66%]" rounded="md" />
            </div>
          </div>
          <div className="relative min-h-[52px] flex-1 p-2">
            <Skeleton
              className="absolute top-2 h-8"
              rounded="2xl"
              style={{ left: `${12 + (i % 4) * 18}%`, width: `${14 + (i % 3) * 8}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CalendarPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeaderSkeleton subtitle={false} />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" rounded="2xl" />
          <Skeleton className="h-10 w-24" rounded="2xl" />
          <Skeleton className="h-10 w-32" rounded="2xl" />
        </div>
      </div>
      <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <Skeleton className="h-9 w-20" rounded="2xl" />
          <Skeleton className="h-9 w-20" rounded="2xl" />
          <Skeleton className="h-9 w-20" rounded="2xl" />
          <Skeleton className="ml-auto h-9 w-28" rounded="2xl" />
        </div>
        <CalendarPlanningSkeleton rows={8} />
      </section>
    </div>
  );
}

export function DataTableSkeleton(props: Readonly<{ rows?: number }>) {
  const n = props.rows ?? 8;
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-zinc-100 px-4 py-3.5 last:border-0"
        >
          <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-[60%]" rounded="lg" />
            <Skeleton className="h-3 w-56 max-w-[80%]" rounded="md" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0" rounded="xl" />
        </div>
      ))}
    </div>
  );
}

export function ReservationsListSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <DataTableSkeleton rows={10} />
    </div>
  );
}

export function MembersListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeaderSkeleton />
        <Skeleton className="h-11 w-36" rounded="2xl" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24" rounded="2xl" />
        ))}
      </div>
      <DataTableSkeleton rows={9} />
    </div>
  );
}

export function BoatsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeaderSkeleton />
        <Skeleton className="h-11 w-40" rounded="2xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-2 rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-sm">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" rounded="2xl" />
          ))}
        </aside>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
              <Skeleton className="aspect-[4/3] w-full" rounded="2xl" />
              <Skeleton className="mt-3 h-5 w-[75%]" rounded="lg" />
              <Skeleton className="mt-2 h-3 w-1/2" rounded="md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton subtitle={false} />
      <Skeleton className="h-14 w-full" rounded="2xl" />
      <section className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <Skeleton className="h-5 w-48" rounded="lg" />
          <Skeleton className="h-11 w-full max-w-md" rounded="xl" />
          <Skeleton className="h-11 w-full max-w-md" rounded="xl" />
          <Skeleton className="h-24 w-full" rounded="2xl" />
        </div>
      </section>
    </div>
  );
}

export function FinancesPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
      <DataTableSkeleton rows={8} />
    </div>
  );
}

export function CatalogPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeaderSkeleton />
        <Skeleton className="h-11 w-40" rounded="2xl" />
      </div>
      <SimpleCardsSkeleton count={6} />
    </div>
  );
}

export function SimpleCardsSkeleton(props: Readonly<{ count?: number }>) {
  const n = props.count ?? 4;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
          <Skeleton className="h-5 w-[66%]" rounded="lg" />
          <Skeleton className="mt-3 h-3 w-full" rounded="md" />
          <Skeleton className="mt-2 h-3 w-[80%]" rounded="md" />
        </div>
      ))}
    </div>
  );
}
