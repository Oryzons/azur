import { Mail } from 'lucide-react';
import { RoundCheckbox } from '@/components/RoundCheckbox';
import { useSettingsStore, type EmailSettings } from '@/stores/settings';

function inputCls() {
  return 'mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</span>;
}

export function EmailsSettingsTab() {
  const emails = useSettingsStore((s) => s.emails);
  const setSettings = useSettingsStore((s) => s.setSettings);

  function patch(p: Partial<EmailSettings>) {
    setSettings({ emails: p });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/15 text-[#416B9F]">
            <Mail className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">E-mails transactionnels</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              Expéditeur et options des confirmations de réservation envoyées aux clients.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <FieldLabel>Nom d&apos;expéditeur</FieldLabel>
          <input value={emails.fromName} onChange={(e) => patch({ fromName: e.target.value })} className={inputCls()} />
        </label>
        <label className="block">
          <FieldLabel>E-mail expéditeur</FieldLabel>
          <input
            type="email"
            value={emails.fromEmail}
            onChange={(e) => patch({ fromEmail: e.target.value })}
            className={inputCls()}
            placeholder="noreply@…"
          />
        </label>
        <label className="block sm:col-span-2">
          <FieldLabel>Adresse de réponse (Reply-To)</FieldLabel>
          <input
            type="email"
            value={emails.replyToEmail}
            onChange={(e) => patch({ replyToEmail: e.target.value })}
            className={inputCls()}
            placeholder="contact@…"
          />
        </label>
      </div>

      <div className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Confirmations de réservation</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
            Envoi automatique de l&apos;e-mail de confirmation après création ou paiement.
          </p>
        </div>
        <RoundCheckbox
          checked={emails.confirmationsEnabled}
          onChange={(v) => patch({ confirmationsEnabled: v })}
        />
      </div>
    </div>
  );
}
