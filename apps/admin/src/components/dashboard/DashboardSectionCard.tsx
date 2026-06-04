import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
  className?: string;
};

export function DashboardSectionCard(props: Readonly<Props>) {
  const { title, description, icon: Icon, href, hrefLabel, children, className = '' } = props;

  return (
    <section
      className={['flex h-full flex-col rounded-2xl border border-zinc-200/90 bg-white shadow-sm', className].join(' ')}
    >
      <div className="border-b border-zinc-100 px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/10 text-[#416B9F]">
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
              {description ? <p className="mt-1 text-sm leading-relaxed text-zinc-500">{description}</p> : null}
            </div>
          </div>
          {href && hrefLabel ? (
            <Link to={href} className="shrink-0 text-sm font-semibold text-[#416B9F] hover:underline">
              {hrefLabel}
            </Link>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">{children}</div>
    </section>
  );
}
