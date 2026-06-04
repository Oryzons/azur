import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bell, Mail } from 'lucide-react';
import { RoundCheckbox } from '@/components/RoundCheckbox';
import {
  ALL_NOTIFICATION_KEYS,
  NOTIFICATION_GROUPS,
  countEnabledNotifications,
  type NotificationToggleKey,
} from '@/lib/notificationSettingsUi';
import { useSettingsStore, type NotificationsSettings } from '@/stores/settings';

function NotificationToggleCard(props: Readonly<{
  label: string;
  hint: string;
  Icon: LucideIcon;
  checked: boolean;
  onChange: (v: boolean) => void;
}>) {
  const Icon = props.Icon;
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex min-w-0 gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">{props.label}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{props.hint}</p>
        </div>
      </div>
      <RoundCheckbox checked={props.checked} onChange={props.onChange} />
    </div>
  );
}

export function NotificationsSettingsTab() {
  const notifications = useSettingsStore((s) => s.notifications);
  const setSettings = useSettingsStore((s) => s.setSettings);

  const enabledCount = useMemo(() => countEnabledNotifications(notifications), [notifications]);
  const totalCount = ALL_NOTIFICATION_KEYS.length;

  function patch(keys: Partial<NotificationsSettings>) {
    setSettings({ notifications: keys });
  }

  function setKey(key: NotificationToggleKey, value: boolean) {
    patch({ [key]: value });
  }

  function setGroup(keys: NotificationToggleKey[], value: boolean) {
    const batch = Object.fromEntries(keys.map((k) => [k, value])) as Partial<NotificationsSettings>;
    patch(batch);
  }

  function setAll(value: boolean) {
    const batch = Object.fromEntries(ALL_NOTIFICATION_KEYS.map((k) => [k, value])) as Partial<NotificationsSettings>;
    patch(batch);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/15 text-[#416B9F]">
            <Bell className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Cloche du back-office</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              Chaque alerte apparaît dans la cloche (et en toast) pour tous les postes connectés. Désactivez les types
              dont vous ne voulez plus être informés — les e-mails clients sont gérés ailleurs.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-zinc-700">
          <span className="font-semibold text-zinc-900">{enabledCount}</span> / {totalCount} types d’alertes actifs
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Tout activer
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Tout désactiver
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-4">
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 shrink-0 text-zinc-400" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">E-mails admin</p>
            <p className="mt-1 text-[11px] text-zinc-500">Bientôt disponible — alertes par e-mail en complément de la cloche.</p>
            <input
              value={notifications.adminEmails}
              onChange={(e) => patch({ adminEmails: e.target.value })}
              disabled
              className="mt-2 w-full cursor-not-allowed rounded-xl border border-zinc-200/90 bg-white/60 px-3 py-2 text-sm text-zinc-400 opacity-70"
              placeholder="admin@…, compta@…"
            />
          </div>
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
            À venir
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {NOTIFICATION_GROUPS.map((group) => {
          const keys = group.items.map((i) => i.key);
          const groupEnabled = keys.filter((k) => notifications[k]).length;
          return (
            <section
              key={group.id}
              className={`rounded-2xl border p-4 sm:p-5 ${group.theme.border} ${group.theme.bg}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className={`text-sm font-semibold ${group.theme.accent}`}>{group.title}</h4>
                  <p className="mt-0.5 text-xs text-zinc-600">{group.description}</p>
                  <p className="mt-1 text-[11px] font-medium text-zinc-500">
                    {groupEnabled} / {keys.length} activé{groupEnabled !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGroup(keys, true)}
                    className="rounded-lg bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-200/80 hover:bg-white"
                  >
                    Tout
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroup(keys, false)}
                    className="rounded-lg bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 shadow-sm ring-1 ring-zinc-200/80 hover:bg-white"
                  >
                    Aucun
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {group.items.map((item) => (
                  <NotificationToggleCard
                    key={item.key}
                    label={item.label}
                    hint={item.hint}
                    Icon={item.Icon}
                    checked={notifications[item.key]}
                    onChange={(v) => setKey(item.key, v)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-[11px] text-zinc-500">Les réglages sont enregistrés automatiquement côté serveur.</p>
    </div>
  );
}
