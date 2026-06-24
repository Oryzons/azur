import { useEffect, useMemo, useState } from 'react';
import {
  Anchor,
  Bell,
  Building2,
  ClipboardCheck,
  FileText,
  Handshake,
  Link2,
  Mail,
} from 'lucide-react';
import { BookingSettingsTab } from '@/pages/parametres/BookingSettingsTab';
import { CheckFlowSettingsTab } from '@/pages/parametres/CheckFlowSettingsTab';
import { ContratsSettingsTab } from '@/pages/parametres/ContratsSettingsTab';
import { EmailsSettingsTab } from '@/pages/parametres/EmailsSettingsTab';
import { NauticManagerSettingsTab } from '@/pages/parametres/NauticManagerSettingsTab';
import { NotificationsSettingsTab } from '@/pages/parametres/NotificationsSettingsTab';
import { PartnersSettingsTab } from '@/pages/parametres/PartnersSettingsTab';
import { PeriodesSettingsTab } from '@/pages/parametres/PeriodesSettingsTab';
import { SocieteSettingsTab } from '@/pages/parametres/SocieteSettingsTab';
import { useSettingsStore } from '@/stores/settings';
import { useDefaultPageFilters } from '@/contexts/PageFiltersContext';
import { ContentReveal } from '@/components/ui/ContentReveal';
import { SettingsPageSkeleton } from '@/components/skeletons/PageSkeletons';

type TabId =
  | 'societe'
  | 'periodes'
  | 'contrats'
  | 'partenaires'
  | 'booking'
  | 'messaging'
  | 'nauticManager'
  | 'notifications'
  | 'checkflow';

function Chip(props: Readonly<{ active: boolean; label: string; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        'rounded-2xl px-4 py-2 text-sm font-semibold transition-colors',
        props.active
          ? 'bg-[#416B9F] text-white shadow-sm shadow-[#416B9F]/20'
          : 'border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-50',
      ].join(' ')}
    >
      {props.label}
    </button>
  );
}

function TabSection(props: Readonly<{ title: string; Icon: typeof Building2; children: React.ReactNode }>) {
  const Icon = props.Icon;
  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm shadow-zinc-200/40">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-zinc-500" strokeWidth={1.75} aria-hidden />
        <h2 className="text-sm font-semibold text-zinc-900">{props.title}</h2>
      </div>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

export function ParametresPage() {
  useDefaultPageFilters('Paramètres');
  const [tab, setTab] = useState<TabId>('societe');
  const updatedAt = useSettingsStore((s) => s.updatedAt);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const refreshSettings = useSettingsStore((s) => s.refresh);
  const resetSettings = useSettingsStore((s) => s.resetSettings);
  useEffect(() => {
    if (!settingsHydrated) void refreshSettings();
  }, [settingsHydrated, refreshSettings]);

  const tabs = useMemo(
    () =>
      [
        { id: 'societe' as const, label: 'Société', Icon: Building2 },
        { id: 'periodes' as const, label: 'Périodes', Icon: FileText },
        { id: 'contrats' as const, label: 'Contrats', Icon: FileText },
        { id: 'partenaires' as const, label: 'Partenaires', Icon: Handshake },
        { id: 'booking' as const, label: 'Réservations', Icon: Anchor },
        { id: 'messaging' as const, label: 'E-mails', Icon: Mail },
        { id: 'nauticManager' as const, label: 'Nautic Manager', Icon: Link2 },
        { id: 'notifications' as const, label: 'Notifications', Icon: Bell },
        { id: 'checkflow' as const, label: 'Check-in/out', Icon: ClipboardCheck },
      ] as const,
    [],
  );

  const activeTab = tabs.find((t) => t.id === tab);

  return (
    <ContentReveal ready={settingsHydrated} skeleton={<SettingsPageSkeleton />}>
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Paramètres</h1>
          <p className="mt-2 text-xs text-zinc-400">Dernière mise à jour : {new Date(updatedAt).toLocaleString('fr-FR')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => resetSettings()}
            className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm shadow-zinc-200/40">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
            <Chip key={t.id} active={tab === t.id} label={t.label} onClick={() => setTab(t.id)} />
          ))}
        </div>
      </section>

      {activeTab && tab !== 'societe' ? (
        <TabSection title={activeTab.label} Icon={activeTab.Icon}>
          {tab === 'notifications' ? <NotificationsSettingsTab /> : null}
          {tab === 'checkflow' ? <CheckFlowSettingsTab /> : null}
          {tab === 'periodes' ? <PeriodesSettingsTab /> : null}
          {tab === 'contrats' ? <ContratsSettingsTab /> : null}
          {tab === 'partenaires' ? <PartnersSettingsTab /> : null}
          {tab === 'booking' ? <BookingSettingsTab /> : null}
          {tab === 'messaging' ? <EmailsSettingsTab /> : null}
          {tab === 'nauticManager' ? <NauticManagerSettingsTab /> : null}
        </TabSection>
      ) : null}

      {tab === 'societe' ? (
        <TabSection title="Société" Icon={Building2}>
          <SocieteSettingsTab />
        </TabSection>
      ) : null}
    </div>
    </ContentReveal>
  );
}
