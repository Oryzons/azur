import { useEffect, useMemo, useState } from 'react';
import { Calendar, CreditCard, RefreshCw, Undo2, X } from 'lucide-react';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import type { Boat } from '@/stores/boats';
import { useBoatPricingStore } from '@/stores/boatPricing';
import { computeCatalogLocationEuros, mergeBoatFleetRates } from '@/lib/calendarRentalPricing';
import { resolvePricingSeasonCode } from '@/lib/pricingSeasons';
import { computeReservationPricingBreakdown } from '@/pages/finances/pricingTotals';
import { useCouponsStore } from '@/stores/coupons';
import { useExtrasStore } from '@/stores/extras';
import { api } from '@/lib/api';
import { extractApiErrorMessage } from '@/lib/apiError';

export type ResolutionKind = 'move' | 'store_credit' | 'refund';

type Props = {
  reservation: Reservation;
  boats: Boat[];
  maxRefundEuros: number | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toDateIso(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const RESOLUTION_OPTIONS: {
  kind: ResolutionKind;
  label: string;
  description: string;
  Icon: typeof RefreshCw;
}[] = [
  {
    kind: 'move',
    label: 'Déplacer la réservation',
    description: 'Nouveau créneau et bateau — tarif recalculé, supplément ou avoir si différence.',
    Icon: RefreshCw,
  },
  {
    kind: 'store_credit',
    label: 'Avoir pour la prochaine location',
    description: 'Annule la réservation et crédite le client — appliqué automatiquement ensuite.',
    Icon: CreditCard,
  },
  {
    kind: 'refund',
    label: 'Rembourser le client',
    description: 'Virement Stripe ou suivi manuel — email de confirmation au client.',
    Icon: Undo2,
  },
];

export function ReservationResolutionPanel(props: Readonly<Props>) {
  const { reservation: r, boats, maxRefundEuros, onClose, onSuccess } = props;
  const [kind, setKind] = useState<ResolutionKind>('move');
  const [boatId, setBoatId] = useState(r.boatId);
  const [dateIso, setDateIso] = useState(toDateIso(r.start));
  const [startTime, setStartTime] = useState(toTime(r.start));
  const [endTime, setEndTime] = useState(toTime(r.end));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [notifyClient, setNotifyClient] = useState(true);
  const [creditLowerDifference, setCreditLowerDifference] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricingPeriods = useBoatPricingStore((s) => s.periods);
  const pricesByPeriodId = useBoatPricingStore((s) => s.pricesByPeriodId);
  const fleetPricesByPeriodId = useBoatPricingStore((s) => s.fleetPricesByPeriodId);
  const pricingHydrated = useBoatPricingStore((s) => s.hydrated);
  const refreshPricing = useBoatPricingStore((s) => s.refresh);
  const extrasCatalog = useExtrasStore((s) => s.extras);
  const couponsCatalog = useCouponsStore((s) => s.coupons);
  const couponRedemptions = useCouponsStore((s) => s.redemptions);

  useEffect(() => {
    if (!pricingHydrated) void refreshPricing();
  }, [pricingHydrated, refreshPricing]);

  useEffect(() => {
    if (maxRefundEuros != null && maxRefundEuros > 0) {
      setAmount(maxRefundEuros.toFixed(2));
    }
  }, [maxRefundEuros]);

  const catalogPreview = useMemo(() => {
    if (kind !== 'move' || !pricingHydrated) return null;
    const month = new Date(`${dateIso}T12:00:00.000`).getMonth();
    const seasonCode = resolvePricingSeasonCode(month);
    const period = pricingPeriods.find((p) => p.code === seasonCode);
    if (!period) return null;
    const boatRow = pricesByPeriodId[period.id]?.rows.find((row) => row.boatId === boatId);
    const boat = boats.find((b) => b.id === boatId);
    const fleetRow = boat?.fleetId
      ? fleetPricesByPeriodId[period.id]?.rows.find((row) => row.fleetId === boat.fleetId)
      : undefined;
    const merged = mergeBoatFleetRates(boatRow, fleetRow);
    return computeCatalogLocationEuros(merged, dateIso, startTime, endTime);
  }, [
    kind,
    pricingHydrated,
    dateIso,
    startTime,
    endTime,
    boatId,
    pricingPeriods,
    pricesByPeriodId,
    fleetPricesByPeriodId,
    boats,
  ]);

  const movePricing = useMemo(() => {
    if (kind !== 'move' || !catalogPreview) return null;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const day = new Date(`${dateIso}T00:00:00.000`);
    const start = new Date(day);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(day);
    end.setHours(eh, em, 0, 0);
    if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);

    const draft: Reservation = {
      ...r,
      boatId,
      start,
      end,
      details: r.details
        ? {
            ...r.details,
            rentalPrice: catalogPreview.euros.toFixed(2).replace('.', ','),
          }
        : undefined,
    };
    const breakdown = computeReservationPricingBreakdown(
      draft,
      extrasCatalog,
      couponsCatalog,
      couponRedemptions,
    );
    if (!breakdown.ok) return null;
    const paid =
      r.totalDueCents != null && r.totalDueCents > 0
        ? r.totalDueCents / 100
        : breakdown.final;
    const delta = Math.round((breakdown.final - paid) * 100) / 100;
    return { breakdown, paid, delta };
  }, [kind, catalogPreview, r, boatId, dateIso, startTime, endTime, extrasCatalog, couponsCatalog, couponRedemptions]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      let body: Record<string, unknown>;
      if (kind === 'move') {
        body = {
          type: 'move',
          boatId,
          dateIso,
          startTime,
          endTime,
          notifyClient,
          creditLowerDifference,
          ...(note.trim() ? { note: note.trim() } : {}),
        };
      } else if (kind === 'store_credit') {
        const parsed = Number.parseFloat(amount.replace(',', '.'));
        body = {
          type: 'store_credit',
          notifyClient,
          ...(Number.isFinite(parsed) && parsed > 0 ? { amount: parsed } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        };
      } else {
        const parsed = Number.parseFloat(amount.replace(',', '.'));
        if (!Number.isFinite(parsed) || parsed <= 0) {
          setError('Montant invalide');
          setSubmitting(false);
          return;
        }
        body = {
          type: 'refund',
          amount: parsed,
          notifyClient,
          ...(note.trim() ? { note: note.trim() } : {}),
        };
      }

      const { data } = await api.post<{ kind: string; emailSent?: boolean; supplementPaymentUrl?: string | null; creditCents?: number }>(
        `/reservations/${r.id}/resolve`,
        body,
      );

      if (data.kind === 'move') {
        const parts = ['Réservation déplacée.'];
        if (data.supplementPaymentUrl) parts.push('Lien de paiement supplément envoyé au client.');
        if (data.creditCents && data.creditCents > 0) {
          parts.push(`Avoir de ${(data.creditCents / 100).toFixed(2)} € enregistré.`);
        }
        onSuccess(parts.join(' '));
      } else if (data.kind === 'store_credit') {
        onSuccess(
          data.emailSent
            ? 'Avoir enregistré — réservation annulée, email envoyé au client.'
            : 'Avoir enregistré — réservation annulée.',
        );
      } else {
        onSuccess(
          data.emailSent
            ? 'Remboursement enregistré — email de confirmation envoyé.'
            : 'Remboursement enregistré.',
        );
      }
      onClose();
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Action impossible.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="shrink-0 border-b border-zinc-200/80 bg-zinc-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-zinc-800">Résolution client</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Choisissez comment traiter cette location.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {RESOLUTION_OPTIONS.map(({ kind: k, label, description, Icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={[
              'rounded-xl border px-3 py-2.5 text-left transition-colors',
              kind === k
                ? 'border-[#416B9F] bg-[#416B9F]/5 ring-1 ring-[#416B9F]/20'
                : 'border-zinc-200 bg-white hover:border-zinc-300',
            ].join(' ')}
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
              <Icon className="h-3.5 w-3.5 text-[#416B9F]" aria-hidden />
              {label}
            </span>
            <span className="mt-1 block text-[10px] leading-snug text-zinc-500">{description}</span>
          </button>
        ))}
      </div>

      {kind === 'move' ? (
        <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-[10px] font-semibold uppercase text-zinc-500">Bateau</span>
              <select
                value={boatId}
                onChange={(e) => setBoatId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm"
              >
                {boats.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-[10px] font-semibold uppercase text-zinc-500">Date</span>
              <input
                type="date"
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-[10px] font-semibold uppercase text-zinc-500">Début</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm"
                />
              </label>
              <label>
                <span className="text-[10px] font-semibold uppercase text-zinc-500">Fin</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm"
                />
              </label>
            </div>
          </div>
          {catalogPreview ? (
            <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
              <p>
                Tarif catalogue :{' '}
                <strong>{catalogPreview.euros.toFixed(2).replace('.', ',')} €</strong>{' '}
                <span className="text-zinc-500">({catalogPreview.note})</span>
              </p>
              {movePricing ? (
                <p className="mt-1">
                  Total TTC estimé :{' '}
                  <strong>{movePricing.breakdown.final.toFixed(2).replace('.', ',')} €</strong>
                  {movePricing.delta > 0.01 ? (
                    <span className="ml-1 text-amber-700">
                      · supplément {movePricing.delta.toFixed(2).replace('.', ',')} €
                    </span>
                  ) : null}
                  {movePricing.delta < -0.01 ? (
                    <span className="ml-1 text-emerald-700">
                      · avoir possible {Math.abs(movePricing.delta).toFixed(2).replace('.', ',')} €
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-amber-700">Tarif indisponible pour ce créneau.</p>
          )}
          {movePricing && movePricing.delta < -0.01 ? (
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={creditLowerDifference}
                onChange={(e) => setCreditLowerDifference(e.target.checked)}
              />
              Créditer la différence en avoir client
            </label>
          ) : null}
        </div>
      ) : null}

      {kind === 'store_credit' || kind === 'refund' ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr]">
          <label>
            <span className="text-[10px] font-semibold uppercase text-zinc-500">
              Montant (€)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm"
            />
            {maxRefundEuros != null ? (
              <span className="mt-0.5 block text-[10px] text-zinc-400">
                Max. {maxRefundEuros.toFixed(2).replace('.', ',')} €
              </span>
            ) : null}
          </label>
          <label>
            <span className="text-[10px] font-semibold uppercase text-zinc-500">Note interne</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm"
            />
          </label>
        </div>
      ) : null}

      {kind === 'move' ? (
        <label className="mt-2 block">
          <span className="text-[10px] font-semibold uppercase text-zinc-500">Note interne</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm"
          />
        </label>
      ) : null}

      <label className="mt-3 flex items-center gap-2 text-xs text-zinc-600">
        <input type="checkbox" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} />
        <Calendar className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
        Prévenir le client par email
      </label>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={submitting || (kind === 'move' && !catalogPreview)}
          onClick={() => void submit()}
          className="rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'En cours…' : 'Confirmer'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
