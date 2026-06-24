import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { computeExtraLineCents, formatExtraRemainingLabel, rentalDaysBetween } from '@bleu-calanque/shared';
import { Portal } from '@/components/Portal';
import { api } from '@/lib/api';
import { ensureReservationClient } from '@/lib/ensureReservationClient';
import { extractApiErrorMessage } from '@/lib/apiError';
import { dayToIso, pad2, startOfDay } from '@/pages/calendar/calendarConstants';
import { emptyWizardDetails } from '@/pages/calendar/reservationWizardTypes';
import { useExtrasStore } from '@/stores/extras';
import { useMembersStore, type MemberClient } from '@/stores/members';
import {
  formatExtraRentalAmount,
  type ExtraRental,
  type ExtraRentalInput,
  type ExtraRentalUpdateInput,
} from '@/stores/extraRentals';

type Props = {
  open: boolean;
  extras: ReturnType<typeof useExtrasStore.getState>['extras'];
  initial?: ExtraRental | null;
  initialDay?: Date;
  initialExtraId?: string;
  onClose: () => void;
  onSave: (input: ExtraRentalInput | ExtraRentalUpdateInput, existingId?: string) => Promise<void>;
  onCancelRental?: (id: string) => Promise<void>;
};

function toLocalDateTimeIso(dateIso: string, time: string): string | null {
  const d = new Date(`${dateIso}T${time}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function inputCls() {
  return 'mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';
}

export function ExtraRentalModal(props: Readonly<Props>) {
  const { open, extras, initial, initialDay, initialExtraId, onClose, onSave, onCancelRental } = props;
  const members = useMembersStore((s) => s.members);
  const addMember = useMembersStore((s) => s.addMember);
  const clients = useMemo(
    () => members.filter((m): m is MemberClient => m.role === 'client'),
    [members],
  );

  const rentableExtras = useMemo(
    () => extras.filter((e) => e.enabled && e.priceKind === 'euro'),
    [extras],
  );

  const [extraId, setExtraId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [startDateIso, setStartDateIso] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDateIso, setEndDateIso] = useState('');
  const [endTime, setEndTime] = useState('18:00');
  const [clientFirstName, setClientFirstName] = useState('');
  const [clientLastName, setClientLastName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [linkedMemberId, setLinkedMemberId] = useState<string | null>(null);
  const [markPaid, setMarkPaid] = useState(false);
  const [settlementNote, setSettlementNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [stockHint, setStockHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedExtra = useMemo(() => rentableExtras.find((e) => e.id === extraId) ?? null, [rentableExtras, extraId]);

  const previewCents = useMemo(() => {
    if (!selectedExtra || !startDateIso || !endDateIso) return null;
    const startAtIso = toLocalDateTimeIso(startDateIso, startTime);
    const endAtIso = toLocalDateTimeIso(endDateIso, endTime);
    if (!startAtIso || !endAtIso) return null;
    const startAt = new Date(startAtIso);
    const endAt = new Date(endAtIso);
    if (endAt <= startAt) return null;
    const rentalDays = rentalDaysBetween(startAt, endAt);
    return computeExtraLineCents(
      0,
      {
        quantity,
        extra: {
          priceKind: 'EURO',
          priceValue: selectedExtra.priceValue,
          billingUnit: selectedExtra.billingUnit,
        },
      },
      rentalDays,
    );
  }, [selectedExtra, startDateIso, endDateIso, startTime, endTime, quantity]);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (initial) {
      const start = new Date(initial.startAt);
      const end = new Date(initial.endAt);
      setExtraId(initial.extraId);
      setQuantity(initial.quantity);
      setStartDateIso(dayToIso(start));
      setStartTime(`${pad2(start.getHours())}:${pad2(start.getMinutes())}`);
      setEndDateIso(dayToIso(end));
      setEndTime(`${pad2(end.getHours())}:${pad2(end.getMinutes())}`);
      setClientFirstName(initial.clientFirstName ?? '');
      setClientLastName(initial.clientLastName ?? '');
      setClientEmail(initial.clientEmail ?? '');
      setClientPhone(initial.clientPhone ?? '');
      setLinkedMemberId(initial.clientMemberId);
      setMarkPaid(false);
      setSettlementNote(initial.settlementNote ?? '');
      setInternalNote(initial.internalNote ?? '');
    } else {
      const day = initialDay ? startOfDay(initialDay) : startOfDay(new Date());
      const dayIso = dayToIso(day);
      setExtraId(initialExtraId ?? rentableExtras[0]?.id ?? '');
      setQuantity(1);
      setStartDateIso(dayIso);
      setEndDateIso(dayIso);
      setStartTime('09:00');
      setEndTime('18:00');
      setClientFirstName('');
      setClientLastName('');
      setClientEmail('');
      setClientPhone('');
      setLinkedMemberId(null);
      setMarkPaid(false);
      setSettlementNote('');
      setInternalNote('');
    }
  }, [open, initial, initialDay, initialExtraId, rentableExtras]);

  useEffect(() => {
    if (!open || !selectedExtra || !startDateIso || !endDateIso) {
      setStockHint(null);
      return;
    }
    const startAtIso = toLocalDateTimeIso(startDateIso, startTime);
    const endAtIso = toLocalDateTimeIso(endDateIso, endTime);
    if (!startAtIso || !endAtIso) return;
    let cancelled = false;
    void api
      .get<Record<string, { remaining: number | null }>>('/extras/availability', {
        params: {
          start: startAtIso,
          end: endAtIso,
          ...(initial?.id ? { excludeExtraRentalId: initial.id } : {}),
        },
      })
      .then(({ data }) => {
        if (cancelled) return;
        const slot = data?.[selectedExtra.id];
        if (!slot || slot.remaining == null) {
          setStockHint('Stock illimité sur ce créneau.');
          return;
        }
        setStockHint(formatExtraRemainingLabel(slot.remaining));
      })
      .catch(() => {
        if (!cancelled) setStockHint(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, selectedExtra, startDateIso, endDateIso, startTime, endTime, initial?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function submit() {
    setError('');
    if (!extraId) {
      setError('Choisissez un extra.');
      return;
    }
    const startAtIso = toLocalDateTimeIso(startDateIso, startTime);
    const endAtIso = toLocalDateTimeIso(endDateIso, endTime);
    if (!startAtIso || !endAtIso) {
      setError('Date ou heure invalide.');
      return;
    }
    if (new Date(endAtIso) <= new Date(startAtIso)) {
      setError('La fin doit être après le début.');
      return;
    }

    let memberId = linkedMemberId;
    if (!memberId) {
      const ensured = await ensureReservationClient(
        {
          ...emptyWizardDetails(),
          clientFirstName,
          clientLastName,
          clientEmail,
          clientPhone,
          linkedMemberId: null,
        },
        clients,
        addMember,
      );
      if (ensured.error) {
        setError(ensured.error);
        return;
      }
      memberId = ensured.details.linkedMemberId;
      if (!memberId) {
        setError('Client introuvable.');
        return;
      }
    }

    const payload: ExtraRentalInput | ExtraRentalUpdateInput = initial
      ? {
          quantity,
          startAt: startAtIso,
          endAt: endAtIso,
          clientMemberId: memberId,
          clientEmail: clientEmail.trim() || null,
          clientFirstName: clientFirstName.trim() || null,
          clientLastName: clientLastName.trim() || null,
          clientPhone: clientPhone.trim() || null,
          settlementNote: settlementNote.trim() || null,
          internalNote: internalNote.trim() || null,
        }
      : {
          extraId,
          quantity,
          startAt: startAtIso,
          endAt: endAtIso,
          clientMemberId: memberId,
          clientEmail: clientEmail.trim() || null,
          clientFirstName: clientFirstName.trim() || null,
          clientLastName: clientLastName.trim() || null,
          clientPhone: clientPhone.trim() || null,
          settlementNote: settlementNote.trim() || null,
          internalNote: internalNote.trim() || null,
          markPaid,
        };

    setSaving(true);
    try {
      await onSave(payload, initial?.id);
      onClose();
    } catch (e) {
      setError(extractApiErrorMessage(e, 'Enregistrement impossible.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelRental() {
    if (!initial?.id || !onCancelRental) return;
    setSaving(true);
    setError('');
    try {
      await onCancelRental(initial.id);
      onClose();
    } catch (e) {
      setError(extractApiErrorMessage(e, 'Annulation impossible.'));
    } finally {
      setSaving(false);
    }
  }

  const readOnly = initial?.status === 'CANCELLED';
  const canMarkPaid = initial?.status === 'PENDING_PAYMENT';

  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
        <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">
                {initial ? 'Location extra' : 'Louer un extra'}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">Sans réservation bateau</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                {error}
              </p>
            ) : null}

            {rentableExtras.length === 0 ? (
              <p className="text-sm text-zinc-600">
                Aucun extra en montant fixe actif. Les extras en pourcentage nécessitent une réservation bateau.
              </p>
            ) : (
              <>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Extra *</span>
                  <select
                    value={extraId}
                    disabled={Boolean(initial) || readOnly}
                    onChange={(e) => setExtraId(e.target.value)}
                    className={inputCls()}
                  >
                    {rentableExtras.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Quantité</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={quantity}
                      disabled={readOnly}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className={inputCls()}
                    />
                  </label>
                  {stockHint ? (
                    <p className="self-end rounded-xl bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900">
                      {stockHint}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Début</span>
                    <input
                      type="date"
                      value={startDateIso}
                      disabled={readOnly}
                      onChange={(e) => setStartDateIso(e.target.value)}
                      className={inputCls()}
                    />
                    <input
                      type="time"
                      value={startTime}
                      disabled={readOnly}
                      onChange={(e) => setStartTime(e.target.value)}
                      className={inputCls()}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fin</span>
                    <input
                      type="date"
                      value={endDateIso}
                      disabled={readOnly}
                      onChange={(e) => setEndDateIso(e.target.value)}
                      className={inputCls()}
                    />
                    <input
                      type="time"
                      value={endTime}
                      disabled={readOnly}
                      onChange={(e) => setEndTime(e.target.value)}
                      className={inputCls()}
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Prénom *</span>
                    <input
                      value={clientFirstName}
                      disabled={readOnly}
                      onChange={(e) => setClientFirstName(e.target.value)}
                      className={inputCls()}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Nom *</span>
                    <input
                      value={clientLastName}
                      disabled={readOnly}
                      onChange={(e) => setClientLastName(e.target.value)}
                      className={inputCls()}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Email *</span>
                  <input
                    type="email"
                    value={clientEmail}
                    disabled={readOnly}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className={inputCls()}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Téléphone</span>
                  <input
                    value={clientPhone}
                    disabled={readOnly}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className={inputCls()}
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Note interne</span>
                  <textarea
                    value={internalNote}
                    disabled={readOnly}
                    onChange={(e) => setInternalNote(e.target.value)}
                    rows={2}
                    className={inputCls()}
                  />
                </label>

                {!initial && selectedExtra?.paymentChannel === 'offline' ? (
                  <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={markPaid}
                      onChange={(e) => setMarkPaid(e.target.checked)}
                      className="rounded border-zinc-300"
                    />
                    Marquer comme réglé sur place
                  </label>
                ) : null}

                {initial && canMarkPaid ? (
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Règlement sur place</span>
                    <input
                      value={settlementNote}
                      onChange={(e) => setSettlementNote(e.target.value)}
                      placeholder="Espèces, TPE…"
                      className={inputCls()}
                    />
                  </label>
                ) : null}

                {previewCents != null ? (
                  <p className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    Total TTC : <strong className="text-zinc-900">{formatExtraRentalAmount(previewCents)}</strong>
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-zinc-100 px-5 py-4">
            {initial && onCancelRental && initial.status !== 'CANCELLED' ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCancelRental()}
                className="rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Annuler la location
              </button>
            ) : null}
            {canMarkPaid ? (
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  if (!initial?.id) return;
                  setSaving(true);
                  setError('');
                  try {
                    const update: ExtraRentalUpdateInput = {
                      markPaid: true,
                      settlementNote: settlementNote.trim() || null,
                    };
                    await onSave(update, initial.id);
                    onClose();
                  } catch (e) {
                    setError(extractApiErrorMessage(e, 'Mise à jour impossible.'));
                  } finally {
                    setSaving(false);
                  }
                }}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                Marquer payée
              </button>
            ) : null}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
              >
                Fermer
              </button>
              {!readOnly && rentableExtras.length > 0 ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submit()}
                  className="rounded-2xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                >
                  {initial ? 'Enregistrer' : 'Créer la location'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
