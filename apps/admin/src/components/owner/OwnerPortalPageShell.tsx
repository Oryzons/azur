import type { LucideIcon } from 'lucide-react';
import { ContentReveal } from '@/components/ui/ContentReveal';
import { SettingsPageSkeleton } from '@/components/skeletons/PageSkeletons';

type Props = Readonly<{
  title: string;
  subtitle: string;
  sectionTitle: string;
  sectionIcon: LucideIcon;
  ready: boolean;
  children: React.ReactNode;
}>;

/** En-tête + carte section, aligné sur `ParametresPage` côté admin. */
export function OwnerPortalPageShell({
  title,
  subtitle,
  sectionTitle,
  sectionIcon: SectionIcon,
  ready,
  children,
}: Props) {
  return (
    <ContentReveal ready={ready} skeleton={<SettingsPageSkeleton />}>
      <div className="space-y-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
          <p className="mt-2 text-xs text-zinc-400">{subtitle}</p>
        </div>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm shadow-zinc-200/40">
          <div className="flex items-center gap-2">
            <SectionIcon className="h-5 w-5 text-zinc-500" strokeWidth={1.75} aria-hidden />
            <h2 className="text-sm font-semibold text-zinc-900">{sectionTitle}</h2>
          </div>
          <div className="mt-4">{children}</div>
        </section>
      </div>
    </ContentReveal>
  );
}
