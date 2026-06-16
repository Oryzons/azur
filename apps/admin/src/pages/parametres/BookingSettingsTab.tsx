import { Anchor } from 'lucide-react';
import { DEFAULT_RENTAL_ARRIVAL_LOCATION, DEFAULT_RENTAL_DEPARTURE_LOCATION } from '@bleu-calanque/shared';
import { RoundCheckbox } from '@/components/RoundCheckbox';
import { useSettingsStore, type BookingSettings } from '@/stores/settings';

function inputCls() {
  return 'mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</span>;
}

export function BookingSettingsTab() {
  const booking = useSettingsStore((s) => s.booking);
  const setSettings = useSettingsStore((s) => s.setSettings);

  function patch(p: Partial<BookingSettings>) {
    setSettings({ booking: p });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/15 text-[#416B9F]">
            <Anchor className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Réservations & paiements</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">
              Lieux par défaut, caution et activation des paiements en ligne pour les nouvelles réservations.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <FieldLabel>Base nautique par défaut</FieldLabel>
          <input
            value={booking.defaultNavalBase}
            onChange={(e) => patch({ defaultNavalBase: e.target.value })}
            className={inputCls()}
            placeholder={DEFAULT_RENTAL_DEPARTURE_LOCATION}
          />
        </label>
        <label className="block">
          <FieldLabel>Lieu de départ</FieldLabel>
          <input
            value={booking.departureLocation}
            onChange={(e) => patch({ departureLocation: e.target.value })}
            className={inputCls()}
            placeholder={DEFAULT_RENTAL_DEPARTURE_LOCATION}
          />
        </label>
        <label className="block">
          <FieldLabel>Lieu de retour</FieldLabel>
          <input
            value={booking.arrivalLocation}
            onChange={(e) => patch({ arrivalLocation: e.target.value })}
            className={inputCls()}
            placeholder={DEFAULT_RENTAL_ARRIVAL_LOCATION}
          />
        </label>
        <label className="block">
          <FieldLabel>Caution par défaut (€)</FieldLabel>
          <input
            value={booking.depositDefaultAmount}
            onChange={(e) => patch({ depositDefaultAmount: e.target.value })}
            className={inputCls()}
            inputMode="decimal"
          />
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Caution obligatoire</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
              Pré-remplit le montant de caution dans le wizard de réservation.
            </p>
          </div>
          <RoundCheckbox checked={booking.requireDeposit} onChange={(v) => patch({ requireDeposit: v })} />
        </div>
        <div className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Paiements en ligne</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
              Permet le canal « En ligne » (Stripe) lors de la création de réservation.
            </p>
          </div>
          <RoundCheckbox
            checked={booking.paymentsOnlineEnabled}
            onChange={(v) => patch({ paymentsOnlineEnabled: v })}
          />
        </div>
      </div>
    </div>
  );
}
