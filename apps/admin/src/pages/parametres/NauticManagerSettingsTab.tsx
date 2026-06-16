import { Link2 } from 'lucide-react';
import { RoundCheckbox } from '@/components/RoundCheckbox';
import { useSettingsStore, type NauticManagerSettings } from '@/stores/settings';

function inputCls() {
  return 'mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</span>;
}

export function NauticManagerSettingsTab() {
  const nauticManager = useSettingsStore((s) => s.nauticManager);
  const setSettings = useSettingsStore((s) => s.setSettings);

  function patch(p: Partial<NauticManagerSettings>) {
    setSettings({ nauticManager: p });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/15 text-[#416B9F]">
            <Link2 className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Nautic Manager</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              Connexion API et synchronisation des propriétaires, bateaux et réservations.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Intégration activée</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
            Active les appels sortants vers l&apos;API Nautic Manager.
          </p>
        </div>
        <RoundCheckbox checked={nauticManager.enabled} onChange={(v) => patch({ enabled: v })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <FieldLabel>URL de l&apos;API</FieldLabel>
          <input
            value={nauticManager.baseUrl}
            onChange={(e) => patch({ baseUrl: e.target.value })}
            className={inputCls()}
            placeholder="https://…"
            disabled={!nauticManager.enabled}
          />
        </label>
        <label className="block">
          <FieldLabel>Clé API</FieldLabel>
          <input
            type="password"
            value={nauticManager.apiKey}
            onChange={(e) => patch({ apiKey: e.target.value })}
            className={inputCls()}
            autoComplete="off"
            disabled={!nauticManager.enabled}
          />
        </label>
        <label className="block">
          <FieldLabel>Secret webhook</FieldLabel>
          <input
            type="password"
            value={nauticManager.webhookSecret}
            onChange={(e) => patch({ webhookSecret: e.target.value })}
            className={inputCls()}
            autoComplete="off"
            disabled={!nauticManager.enabled}
          />
        </label>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Synchronisation</p>
        {(
          [
            ['syncOwners', 'Propriétaires'],
            ['syncBoats', 'Bateaux'],
            ['syncReservations', 'Réservations'],
          ] as const
        ).map(([key, label]) => (
          <div
            key={key}
            className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-sm"
          >
            <p className="text-sm font-semibold text-zinc-900">{label}</p>
            <RoundCheckbox
              checked={nauticManager[key]}
              onChange={(v) => patch({ [key]: v })}
              disabled={!nauticManager.enabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
