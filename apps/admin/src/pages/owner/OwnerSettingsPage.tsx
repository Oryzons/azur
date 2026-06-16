import { useCallback, useEffect, useMemo, useRef, useState, useId } from 'react';
import {
  Bell,
  CalendarPlus,
  CreditCard,
  Pencil,
  RotateCcw,
  Settings,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { RoundCheckbox } from '@/components/RoundCheckbox';
import { api } from '@/lib/api';
import { extractApiErrorMessage } from '@/lib/apiError';
import { useDefaultPageFilters } from '@/contexts/PageFiltersContext';
import { OwnerPortalPageShell } from '@/components/owner/OwnerPortalPageShell';

export type OwnerNotificationPreferences = {
  enabled: boolean;
  onNewReservation: boolean;
  onReservationUpdated: boolean;
  onReservationCancelled: boolean;
  onReservationRestored: boolean;
  onReservationPaid: boolean;
};

type PrefKey = keyof Omit<OwnerNotificationPreferences, 'enabled'>;

const DETAIL_TOGGLES: {
  key: PrefKey;
  label: string;
  hint: string;
  Icon: LucideIcon;
}[] = [
  {
    key: 'onNewReservation',
    label: 'Nouvelle réservation',
    hint: 'Une réservation vient d’être créée sur vos bateaux.',
    Icon: CalendarPlus,
  },
  {
    key: 'onReservationUpdated',
    label: 'Réservation modifiée',
    hint: 'Dates, bateau ou montants changés par l’équipe.',
    Icon: Pencil,
  },
  {
    key: 'onReservationCancelled',
    label: 'Réservation annulée',
    hint: 'Statut annulé ou suppression de la fiche.',
    Icon: Trash2,
  },
  {
    key: 'onReservationRestored',
    label: 'Réservation rétablie',
    hint: 'Annulation retirée, réservation de nouveau active.',
    Icon: RotateCcw,
  },
  {
    key: 'onReservationPaid',
    label: 'Paiement encaissé',
    hint: 'Paiement enregistré sur une location de votre bateau.',
    Icon: CreditCard,
  },
];

function NotificationToggleCard(props: Readonly<{
  label: string;
  hint: string;
  Icon: LucideIcon;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}>) {
  const inputId = useId();
  const Icon = props.Icon;
  return (
    <label
      htmlFor={inputId}
      className={[
        'flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-sm',
        props.disabled ? 'cursor-not-allowed opacity-55' : 'hover:border-zinc-300',
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-1 gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">{props.label}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{props.hint}</p>
        </div>
      </div>
      <RoundCheckbox
        id={inputId}
        checked={props.checked}
        disabled={props.disabled}
        onChange={props.onChange}
        className="pointer-events-auto shrink-0"
      />
    </label>
  );
}

export function OwnerSettingsPage() {
  useDefaultPageFilters('Paramètres');
  const [prefs, setPrefs] = useState<OwnerNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const saveSeqRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<OwnerNotificationPreferences>('/owner/notification-preferences');
      setPrefs({
        enabled: Boolean(data.enabled),
        onNewReservation: Boolean(data.onNewReservation),
        onReservationUpdated: Boolean(data.onReservationUpdated),
        onReservationCancelled: Boolean(data.onReservationCancelled),
        onReservationRestored: Boolean(data.onReservationRestored),
        onReservationPaid: Boolean(data.onReservationPaid),
      });
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err, 'Impossible de charger vos préférences.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enabledCount = useMemo(() => {
    if (!prefs) return 0;
    return DETAIL_TOGGLES.filter((t) => prefs[t.key]).length;
  }, [prefs]);

  const persist = useCallback(async (next: OwnerNotificationPreferences) => {
    const seq = ++saveSeqRef.current;
    setSaving(true);
    setError('');
    setSuccess('');
    setPrefs(next);
    try {
      const { data } = await api.put<OwnerNotificationPreferences>(
        '/owner/notification-preferences',
        next,
      );
      if (seq !== saveSeqRef.current) return;
      setPrefs({
        enabled: Boolean(data.enabled),
        onNewReservation: Boolean(data.onNewReservation),
        onReservationUpdated: Boolean(data.onReservationUpdated),
        onReservationCancelled: Boolean(data.onReservationCancelled),
        onReservationRestored: Boolean(data.onReservationRestored),
        onReservationPaid: Boolean(data.onReservationPaid),
      });
      setSuccess('Préférences enregistrées.');
      window.setTimeout(() => setSuccess(''), 2500);
    } catch (err: unknown) {
      if (seq !== saveSeqRef.current) return;
      setError(extractApiErrorMessage(err, 'Enregistrement impossible. Réessayez.'));
      await load();
    } finally {
      if (seq === saveSeqRef.current) setSaving(false);
    }
  }, [load]);

  function apply(patch: Partial<OwnerNotificationPreferences>) {
    if (!prefs) return;
    void persist({ ...prefs, ...patch });
  }

  function setEnabled(enabled: boolean) {
    apply({ enabled });
  }

  function setDetail(key: PrefKey, value: boolean) {
    apply({ [key]: value });
  }

  function setAllDetails(value: boolean) {
    if (!prefs) return;
    void persist({
      ...prefs,
      onNewReservation: value,
      onReservationUpdated: value,
      onReservationCancelled: value,
      onReservationRestored: value,
      onReservationPaid: value,
    });
  }

  return (
    <OwnerPortalPageShell
      title="Paramètres"
      subtitle="Alertes cloche pour les réservations sur vos bateaux"
      sectionTitle="Notifications"
      sectionIcon={Settings}
      ready={!loading}
    >
      {error && !prefs ? (
        <div className="rounded-2xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-red-300/80 bg-white px-4 py-2 text-sm font-semibold text-red-900 shadow-sm hover:bg-red-50"
          >
            Réessayer
          </button>
        </div>
      ) : prefs ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/15 text-[#416B9F]">
                <Bell className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Cloche du portail propriétaire</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  Chaque alerte apparaît dans la cloche (et en toast) lorsqu’un événement concerne{' '}
                  <strong>vos bateaux</strong>. Les choix sont enregistrés sur votre compte en base de données.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-zinc-700">
              <span className="font-semibold text-zinc-900">{prefs.enabled ? enabledCount : 0}</span> /{' '}
              {DETAIL_TOGGLES.length} types d’alertes actifs
              {saving ? <span className="ml-2 text-xs text-zinc-400">Enregistrement…</span> : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAllDetails(true)}
                disabled={saving || !prefs.enabled}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                Tout activer
              </button>
              <button
                type="button"
                onClick={() => setAllDetails(false)}
                disabled={saving || !prefs.enabled}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                Tout désactiver
              </button>
            </div>
          </div>

          <NotificationToggleCard
            label="Notifications réservations"
            hint="Interrupteur principal — coupe toutes les alertes ci-dessous."
            Icon={Bell}
            checked={prefs.enabled}
            disabled={saving}
            onChange={setEnabled}
          />

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          ) : null}
          {success ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {success}
            </p>
          ) : null}

          <section
            className={[
              'rounded-2xl border border-sky-200 bg-sky-50/50 p-4 sm:p-5 transition-opacity',
              prefs.enabled ? '' : 'opacity-45',
            ].join(' ')}
            aria-disabled={!prefs.enabled}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-sky-800">Réservations</h4>
                <p className="mt-0.5 text-xs text-zinc-600">
                  Création, modification, annulation et paiement sur vos bateaux.
                </p>
                <p className="mt-1 text-[11px] font-medium text-zinc-500">
                  {enabledCount} / {DETAIL_TOGGLES.length} activé{enabledCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setAllDetails(true)}
                  disabled={saving || !prefs.enabled}
                  className="rounded-lg bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200/80 hover:bg-white disabled:opacity-50"
                >
                  Tout
                </button>
                <button
                  type="button"
                  onClick={() => setAllDetails(false)}
                  disabled={saving || !prefs.enabled}
                  className="rounded-lg bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 shadow-sm ring-1 ring-zinc-200/80 hover:bg-white disabled:opacity-50"
                >
                  Aucun
                </button>
              </div>
            </div>
            <div
              className={[
                'mt-4 grid gap-2 sm:grid-cols-2',
                prefs.enabled ? '' : 'pointer-events-none',
              ].join(' ')}
            >
              {DETAIL_TOGGLES.map((t) => (
                <NotificationToggleCard
                  key={t.key}
                  label={t.label}
                  hint={t.hint}
                  Icon={t.Icon}
                  checked={prefs[t.key]}
                  disabled={saving || !prefs.enabled}
                  onChange={(v) => setDetail(t.key, v)}
                />
              ))}
            </div>
          </section>

          <p className="text-[11px] text-zinc-500">Les réglages sont enregistrés automatiquement sur votre compte.</p>
        </div>
      ) : null}
    </OwnerPortalPageShell>
  );
}
