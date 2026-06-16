import { Landmark } from 'lucide-react';
import { useSettingsStore, type BankSettings } from '@/stores/settings';

function inputCls() {
  return 'mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</span>;
}

export function BankSettingsTab() {
  const bank = useSettingsStore((s) => s.bank);
  const setSettings = useSettingsStore((s) => s.setSettings);

  function patch(p: Partial<BankSettings>) {
    setSettings({ bank: p });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/15 text-[#416B9F]">
            <Landmark className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Coordonnées bancaires</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              Utilisées sur les documents et communications de paiement. Enregistrement automatique à la saisie.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <FieldLabel>Titulaire du compte</FieldLabel>
          <input value={bank.accountHolder} onChange={(e) => patch({ accountHolder: e.target.value })} className={inputCls()} />
        </label>
        <label className="block">
          <FieldLabel>IBAN</FieldLabel>
          <input value={bank.iban} onChange={(e) => patch({ iban: e.target.value })} className={`${inputCls()} font-mono`} />
        </label>
        <label className="block">
          <FieldLabel>BIC</FieldLabel>
          <input value={bank.bic} onChange={(e) => patch({ bic: e.target.value })} className={`${inputCls()} font-mono`} />
        </label>
        <label className="block sm:col-span-2">
          <FieldLabel>Établissement bancaire</FieldLabel>
          <input value={bank.bankName} onChange={(e) => patch({ bankName: e.target.value })} className={inputCls()} />
        </label>
      </div>
    </div>
  );
}
