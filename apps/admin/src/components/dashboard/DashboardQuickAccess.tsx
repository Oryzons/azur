import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DASHBOARD_QUICK_LINKS } from '@/lib/dashboardQuickLinks';

export function DashboardQuickAccess() {
  return (
    <section aria-labelledby="dashboard-quick-access-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="dashboard-quick-access-title" className="text-sm font-semibold text-zinc-900">
            Accès rapide
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">Les pages les plus utilisées en un clic.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {DASHBOARD_QUICK_LINKS.map((item) => {
          const primary = item.accent === 'primary';
          return (
            <Link
              key={item.to}
              to={item.to}
              className={[
                'group flex min-h-[5.5rem] flex-col justify-between rounded-2xl border p-3.5 shadow-sm transition-all',
                primary
                  ? 'border-[#416B9F]/35 bg-gradient-to-br from-[#416B9F]/12 to-white ring-1 ring-[#416B9F]/15 hover:border-[#416B9F]/50 hover:shadow-md'
                  : 'border-zinc-200/90 bg-white hover:border-[#416B9F]/30 hover:bg-zinc-50/80',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-xl',
                  primary ? 'bg-[#416B9F] text-white' : 'bg-zinc-100 text-[#416B9F]',
                ].join(' ')}
              >
                <item.Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="mt-2 min-w-0">
                <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-500">{item.description}</p>
              </div>
              <ArrowRight
                className="mt-2 h-3.5 w-3.5 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#416B9F]"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
