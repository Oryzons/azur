import type { LucideIcon } from 'lucide-react';
import { FluidInlineAmount } from '@/components/ui/FluidInlineAmount';
import { euro } from '@/pages/finances/pricingTotals';

type KpiItem = {
  label: string;
  value: number;
  format?: (n: number) => string;
  hint: string;
  Icon: LucideIcon;
  tone?: 'default' | 'brand' | 'success' | 'warning';
};

const toneStyles = {
  default: 'bg-white border-zinc-200/90',
  brand: 'bg-[#416B9F]/8 border-[#416B9F]/20',
  success: 'bg-emerald-50/80 border-emerald-200/80',
  warning: 'bg-orange-50/80 border-orange-200/80',
};

const iconToneStyles = {
  default: 'bg-zinc-100 text-zinc-600',
  brand: 'bg-[#416B9F] text-white',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-orange-100 text-orange-800',
};

export function DashboardKpiStrip(props: Readonly<{ items: KpiItem[] }>) {
  return (
    <section aria-labelledby="dashboard-kpi-title">
      <h2 id="dashboard-kpi-title" className="sr-only">
        Indicateurs du jour
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {props.items.map((item) => {
          const tone = item.tone ?? 'default';
          const fmt = item.format ?? ((n: number) => String(n));
          return (
            <div
              key={item.label}
              className={['min-w-0 rounded-2xl border p-4 shadow-sm', toneStyles[tone]].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={['flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', iconToneStyles[tone]].join(' ')}>
                  <item.Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
              </div>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{item.label}</p>
              <FluidInlineAmount
                className="mt-1"
                value={item.value}
                format={fmt}
              />
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">{item.hint}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function formatEuroKpi(n: number) {
  return `${euro(n)} €`;
}
