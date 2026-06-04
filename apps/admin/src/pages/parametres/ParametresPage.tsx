import { useEffect, useMemo, useState } from 'react';
import { Bell, Building2, ClipboardCheck, FileText, Handshake, LifeBuoy, Shield } from 'lucide-react';
import { CheckFlowSettingsTab } from '@/pages/parametres/CheckFlowSettingsTab';
import { ContratsSettingsTab } from '@/pages/parametres/ContratsSettingsTab';
import { NotificationsSettingsTab } from '@/pages/parametres/NotificationsSettingsTab';
import { PartnersSettingsTab } from '@/pages/parametres/PartnersSettingsTab';
import { PeriodesSettingsTab } from '@/pages/parametres/PeriodesSettingsTab';
import { SocieteSettingsTab } from '@/pages/parametres/SocieteSettingsTab';
import { useSettingsStore } from '@/stores/settings';
import { useDefaultPageFilters } from '@/contexts/PageFiltersContext';
import { ContentReveal } from '@/components/ui/ContentReveal';
import { SettingsPageSkeleton } from '@/components/skeletons/PageSkeletons';

type TabId = 'societe' | 'periodes' | 'contrats' | 'partenaires' | 'notifications' | 'checkflow';

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
        { id: 'notifications' as const, label: 'Notifications', Icon: Bell },
        { id: 'checkflow' as const, label: 'Check-in/out', Icon: ClipboardCheck },
      ] as const,
    [],
  );

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
            <Shield className="h-4 w-4 text-zinc-500" strokeWidth={1.9} aria-hidden />
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

      {tab === 'societe' ? (
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm shadow-zinc-200/40">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-zinc-500" strokeWidth={1.75} aria-hidden />
            <h2 className="text-sm font-semibold text-zinc-900">Société</h2>
          </div>
          <div className="mt-4">
            <SocieteSettingsTab />
          </div>
        </section>
      ) : null}

      {tab === 'notifications' ? (
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm shadow-zinc-200/40">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-zinc-500" strokeWidth={1.75} aria-hidden />
            <h2 className="text-sm font-semibold text-zinc-900">Notifications</h2>
          </div>
          <div className="mt-4">
            <NotificationsSettingsTab />
          </div>
        </section>
      ) : null}

      {tab === 'checkflow' ? (
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm shadow-zinc-200/40">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-zinc-500" strokeWidth={1.75} aria-hidden />
            <h2 className="text-sm font-semibold text-zinc-900">Check-in / Check-out</h2>
          </div>
          <div className="mt-4">
            <CheckFlowSettingsTab />
          </div>
        </section>
      ) : null}

      {tab === 'periodes' ? (
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm shadow-zinc-200/40">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-zinc-500" strokeWidth={1.75} aria-hidden />
            <h2 className="text-sm font-semibold text-zinc-900">Tarifs & saisons</h2>
          </div>
          <div className="mt-4">
            <PeriodesSettingsTab />
          </div>
        </section>
      ) : null}

      {tab === 'contrats' ? (
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm shadow-zinc-200/40">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-zinc-500" strokeWidth={1.75} aria-hidden />
            <h2 className="text-sm font-semibold text-zinc-900">Contrats</h2>
          </div>
          <div className="mt-4">
            <ContratsSettingsTab />
          </div>
        </section>
      ) : null}

      {tab === 'partenaires' ? (
        <section className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm shadow-zinc-200/40">
          <div className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-zinc-500" strokeWidth={1.75} aria-hidden />
            <h2 className="text-sm font-semibold text-zinc-900">Partenaires</h2>
          </div>
          <div className="mt-4">
            <PartnersSettingsTab />
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm shadow-zinc-200/40">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600" aria-hidden>
            <LifeBuoy className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">À brancher ensuite</p>
            <p className="mt-1 text-sm text-zinc-600">
              La plupart des onglets sont synchronisés avec le serveur. Utilisez « Réinitialiser » uniquement pour revenir aux
              valeurs par défaut locales en cas de besoin.
            </p>
          </div>
        </div>
      </section>
    </div>
    </ContentReveal>
  );
}

