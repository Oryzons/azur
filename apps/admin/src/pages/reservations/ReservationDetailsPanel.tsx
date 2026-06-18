import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Anchor,
  Baby,
  Ban,
  Banknote,
  Calendar,
  CircleCheck,
  Clock,
  Globe,
  Link2,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  RefreshCw,
  RotateCcw,
  Send,
  FileText,
  Eye,
  FileDown,
  Receipt,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Undo2,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  IconActionButton,
  InfoRow,
  SectionCard,
  StatusBanner,
} from '@/pages/reservations/reservationDetailsUi';
import { Portal } from '@/components/Portal';
import { ReservationResolutionPanel } from '@/components/reservations/ReservationResolutionPanel';
import { CancelReservationDialog } from '@/components/ui/CancelReservationDialog';
import { startOfDay } from '@/pages/calendar/calendarConstants';
import { BOAT_TYPES_UI, type Boat, type Fleet } from '@/stores/boats';
import { reservationPaymentContext } from '@/lib/reservationOfflineDue';
import { useExtrasStore } from '@/stores/extras';
import { useCouponsStore } from '@/stores/coupons';
import { computeReservationPricingDisplay } from '@/lib/reservationPricingDisplay';
import { useMembersStore } from '@/stores/members';
import { ReservationCheckFlowBlock } from '@/components/reservations/ReservationCheckFlowBlock';
import { RentalContractStatusBadge } from '@/components/reservations/RentalContractStatusBadge';
import { deserializeReservation, useReservationsStore } from '@/stores/reservations';
import { useNotificationsStore } from '@/stores/notifications';
import { api } from '@/lib/api';
import { paymentMethodLabel } from '@bleu-calanque/shared';
import { extractApiErrorMessage } from '@/lib/apiError';
import { filenameFromContentDisposition, openPdfBlobInNewTab } from '@/lib/openPdfBlob';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import type { ReservationWizardDetails } from '@/pages/calendar/reservationWizardTypes';
import {
  RESERVATION_STATUSES,
  canRestoreReservation,
  hasReservationCancellation,
  isReservationCancelled,
  isReservationFullyPaid,
  resolveReservationStatus,
  statusAfterPaymentCaptured,
  statusBadgeClass,
  statusDisplayLabel,
  syncStatusFields,
  type ReservationStatus,
} from '@/lib/reservationStatus';
import {
  getReservationLockMessageFromReservation,
  isReservationLockedFromReservation,
} from '@/lib/reservationLock';
import { useCheckFlowStore } from '@/stores/checkFlow';
import { ContractDocumentsChecklist } from '@/components/reservations/ContractDocumentsChecklist';
import { useSettingsStore } from '@/stores/settings';

function fmtTime(d: Date) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateLong(d: Date) {
  return startOfDay(d).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtBirthDisplay(raw: string | undefined | null): string {
  if (!raw?.trim()) return '—';
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return `${d}/${m}/${y}`;
  }
  return s;
}

function fmtEurosFromCents(cents: number | null | undefined): string {
  if (cents == null) return '—';
  const euros = cents / 100;
  return euros.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function sameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function reservationSummaryCardClass(
  status: ReservationStatus | null,
  details?: Reservation['details'] | null,
): string {
  if (hasReservationCancellation(details)) {
    if (status === 'refunded') {
      return 'border-indigo-200/90 bg-gradient-to-br from-indigo-50/90 via-red-50/40 to-white';
    }
    if (status === 'partially_refunded') {
      return 'border-fuchsia-200/90 bg-gradient-to-br from-fuchsia-50/90 via-red-50/40 to-white';
    }
    return 'border-red-200/90 bg-gradient-to-br from-red-50/90 to-white';
  }
  switch (status) {
    case 'refunded':
      return 'border-indigo-200/90 bg-gradient-to-br from-indigo-50/90 to-white';
    case 'partially_refunded':
      return 'border-fuchsia-200/90 bg-gradient-to-br from-fuchsia-50/90 to-white';
    case 'cancelled':
      return 'border-red-200/90 bg-gradient-to-br from-red-50/90 to-white';
    default:
      return 'border-[#416B9F]/20 bg-gradient-to-br from-[#416B9F]/8 to-white';
  }
}

function reservationLockAlertClass(status: ReservationStatus | null, locked: boolean): string {
  if (locked) return 'border-amber-200/80 bg-amber-50 text-amber-950';
  switch (status) {
    case 'refunded':
      return 'border-indigo-200/80 bg-indigo-50 text-indigo-950';
    case 'partially_refunded':
      return 'border-fuchsia-200/80 bg-fuchsia-50 text-fuchsia-950';
    case 'cancelled':
      return 'border-red-200/80 bg-red-50 text-red-900';
    default:
      return 'border-sky-200/80 bg-sky-50 text-sky-900';
  }
}

function ClientBlockPresent(props: Readonly<{
  details: NonNullable<Reservation['details']>;
  linkedMemberLabel: string | null;
  reservationId: string;
  onOpenReservation?: (id: string) => void;
}>) {
  const d = props.details;
  const civ = d.civility ? `${d.civility} ` : '';
  const clientName = `${civ}${d.clientFirstName} ${d.clientLastName}`.trim() || '—';
  let linked: string = '—';
  if (d.linkedMemberId?.trim()) {
    linked = props.linkedMemberLabel ? props.linkedMemberLabel : 'Compte membre';
  }
  return (
    <SectionCard icon={User} title="Client" collapsible>
      <InfoRow icon={User} label="Nom" value={clientName} highlight />
      <InfoRow icon={Mail} label="Email" value={d.clientEmail || '—'} />
      <InfoRow icon={Phone} label="Téléphone" value={d.clientPhone?.trim() || '—'} />
      <InfoRow icon={Calendar} label="Date de naissance" value={fmtBirthDisplay(d.clientBirthDateDisplay)} />
      <InfoRow icon={Tag} label="Type client" value={d.clientType} />
      <InfoRow icon={Link2} label="Fiche membre liée" value={linked} />
      <InfoRow
        icon={MapPin}
        label="Adresse"
        value={
          d.clientAddress?.trim()
            ? `${d.clientAddress}, ${d.clientPostalCode} ${d.clientCity}`.trim()
            : '—'
        }
      />
      <InfoRow icon={Globe} label="Pays" value={d.clientCountry || '—'} />
      {d.clientIdNumber?.trim() ? (
        <InfoRow
          icon={Tag}
          label="Pièce d'identité"
          value={`${d.clientIdType?.trim() || "Carte d'identité"} — ${d.clientIdNumber.trim()}`}
        />
      ) : null}
      {d.licenseNumber?.trim() || d.licenseType?.trim() ? (
        <InfoRow
          icon={Tag}
          label="Permis bateau"
          value={[
            d.licenseType?.trim(),
            d.licenseNumber?.trim(),
            d.licenseCountry?.trim(),
            d.licenseYear?.trim() ? `(${d.licenseYear.trim()})` : '',
          ]
            .filter(Boolean)
            .join(' · ') || '—'}
        />
      ) : null}
    </SectionCard>
  );
}

function ClientBlock(props: Readonly<{
  details: Reservation['details'] | null;
  linkedMemberLabel: string | null;
  reservationId: string;
  onOpenReservation?: (id: string) => void;
}>) {
  const d = props.details ?? null;
  if (!d) {
    return (
      <SectionCard icon={User} title="Client" collapsible>
        <p className="text-sm text-zinc-500">Détails client non disponibles.</p>
      </SectionCard>
    );
  }
  return (
    <ClientBlockPresent
      details={d}
      linkedMemberLabel={props.linkedMemberLabel}
      reservationId={props.reservationId}
      onOpenReservation={props.onOpenReservation}
    />
  );
}

function ReservationBlockPresent(props: Readonly<{ reservation: Reservation; details: NonNullable<Reservation['details']>; extrasLabel: ReactNode }>) {
  const { reservation: r, details: d } = props;
  const kids = d.hasChildren ? `${d.childrenCount} enfant${d.childrenCount > 1 ? 's' : ''}` : 'Aucun';
  const periodDate = fmtDateLong(r.start);
  const periodHours = sameCalendarDay(r.start, r.end)
    ? `${fmtTime(r.start)} → ${fmtTime(r.end)}`
    : `${fmtTime(r.start)} (départ) · ${fmtTime(r.end)} (retour)`;
  return (
    <SectionCard icon={Calendar} title="Créneau & passagers" accent="sky" collapsible>
      <InfoRow icon={Calendar} label="Date" value={periodDate} highlight />
      <InfoRow icon={Clock} label="Horaires" value={periodHours} />
      <InfoRow icon={Tag} label="Libellé calendrier" value={r.title} />
      <InfoRow icon={Users} label="Passagers" value={String(d.passengerCount)} />
      <InfoRow icon={Baby} label="Enfants à bord" value={kids} />
      <InfoRow icon={Package} label="Extras" value={props.extrasLabel ?? 'Aucun'} />
      {d.internalNote?.trim() ? (
        <InfoRow
          icon={AlertCircle}
          label="Note interne"
          value={<span className="whitespace-pre-wrap font-normal text-zinc-700">{d.internalNote}</span>}
        />
      ) : null}
    </SectionCard>
  );
}

function InstallmentPlanRows(props: Readonly<{ reservation: Reservation; locked?: boolean }>) {
  const { reservation, locked } = props;
  const plan = reservation.installmentPlan ?? [];
  const refreshReservations = useReservationsStore((s) => s.refresh);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  if (plan.length < 2) return null;

  async function settle(sequence: number, paid: boolean) {
    setBusy(sequence);
    setError('');
    try {
      await api.post(`/reservations/${reservation.id}/installments/${sequence}/settle`, { paid });
      await refreshReservations();
    } catch {
      setError('Action impossible. Réessayez.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-[#416B9F]/20 bg-[#416B9F]/5 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#416B9F]">
        Plan d’échéances ({plan.length} fois)
      </p>
      {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
      {plan.map((p) => {
        const paid = p.status === 'PAID';
        return (
          <div key={p.sequence} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-zinc-900">
                {p.label ?? `Échéance ${p.sequence}`}
              </span>{' '}
              <span className="text-zinc-500">· {paymentMethodLabel(p.method)}</span>
            </span>
            <span className="font-semibold text-zinc-900">
              {(p.amountCents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
            {paid ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
                Réglé
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
                En attente
              </span>
            )}
            {!locked ? (
              <button
                type="button"
                disabled={busy === p.sequence}
                onClick={() => settle(p.sequence, !paid)}
                className={[
                  'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50',
                  paid
                    ? 'text-zinc-600 hover:bg-zinc-100'
                    : 'bg-[#416B9F] text-white hover:bg-[#365b87]',
                ].join(' ')}
              >
                {busy === p.sequence ? '…' : paid ? 'Annuler' : 'Marquer réglé'}
              </button>
            ) : null}
            {!paid && p.method === 'ONLINE' && p.paymentLinkUrl ? (
              <a
                href={p.paymentLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#416B9F] hover:bg-[#416B9F]/10"
              >
                Lien
              </a>
            ) : null}
          </div>
        );
      })}
      <p className="text-[10px] leading-relaxed text-zinc-500">
        Régler l’acompte confirme la réservation. Si le solde est en ligne, le 2e lien est envoyé automatiquement après l’acompte.
      </p>
    </div>
  );
}

function PricingBlockPresent(
  props: Readonly<{
    reservation: Reservation;
    stripeDepositPaymentIntentId?: string | null;
    onStatusChange?: (status: ReservationStatus) => void;
    locked?: boolean;
  }>,
) {
  const d = props.reservation.details!;
  const extrasCatalog = useExtrasStore((s) => s.extras);
  const couponsCatalog = useCouponsStore((s) => s.coupons);
  const reservationItems = useReservationsStore((s) => s.items);
  const allReservations = useMemo(
    () => reservationItems.map((s) => deserializeReservation(s)),
    [reservationItems],
  );
  const pricing = useMemo(
    () =>
      computeReservationPricingDisplay(props.reservation, extrasCatalog, couponsCatalog, allReservations),
    [allReservations, props.reservation, extrasCatalog, couponsCatalog],
  );
  const payment = d.paymentChannel === 'online' ? 'En ligne' : 'Hors ligne';
  const rentalPrice =
    pricing.rentalBrutEuros != null ? `${pricing.rentalBrutEuros.toFixed(2).replace('.', ',')} €` : '—';
  const manual = d.discountPercent?.trim() ? `${d.discountPercent}%` : '—';
  const coupon = d.couponCode?.trim() ? d.couponCode : '—';
  const deposit = d.depositAmount?.trim() ? `${d.depositAmount} €` : '—';
  const paymentCaptured = d.paymentCapturedAt ? new Date(d.paymentCapturedAt).toLocaleString('fr-FR') : '—';
  const depositCaptured = d.depositCapturedAt ? new Date(d.depositCapturedAt).toLocaleString('fr-FR') : '—';
  const mailSent = d.confirmationEmailSentAt ? new Date(d.confirmationEmailSentAt).toLocaleString('fr-FR') : '—';
  const refunds = Array.isArray(d.refunds) ? d.refunds : [];
  const refundsTotal = Math.round(refunds.reduce((sum, r) => sum + Number(r.amount || 0), 0) * 100) / 100;
  const cancelled = d.cancelledAt ? new Date(d.cancelledAt).toLocaleString('fr-FR') : null;
  const status = resolveReservationStatus(d);
  const paymentCtx = reservationPaymentContext(props.reservation, extrasCatalog);
  const isOnline = d.paymentChannel === 'online';
  const isFullyPaid = isReservationFullyPaid(paymentCtx, d);
  const hasAnyPayment = isFullyPaid || Boolean(d.paymentCapturedAt) || status === 'reserved_paid';
  const isPaid = hasAnyPayment;
  const hasDeposit = Boolean(d.depositAmount?.trim());
  const depositHoldPlaced = Boolean(props.stripeDepositPaymentIntentId);
  const depositHoldMissing = isOnline && isPaid && hasDeposit && !depositHoldPlaced;

  let depositBanner: ReactNode = null;
  if (depositHoldPlaced) {
    depositBanner = (
      <StatusBanner
        tone="success"
        icon={ShieldCheck}
        title="Empreinte caution enregistrée"
        detail="Autorisation bancaire sans débit — la caution peut être capturée plus tard si besoin."
      />
    );
  } else if (depositHoldMissing) {
    depositBanner = (
      <StatusBanner
        tone="danger"
        icon={ShieldAlert}
        trailingIcon={X}
        title="Empreinte caution non retenue"
        detail="Paiement reçu mais blocage caution absent (fréquent avec Apple Pay). Utilisez « Sync. Stripe » ou une carte classique."
      />
    );
  } else if (isOnline && hasDeposit && !isPaid) {
    depositBanner = (
      <StatusBanner
        tone="neutral"
        icon={Shield}
        title="Empreinte après paiement"
        detail="La caution sera demandée automatiquement une fois le paiement en ligne confirmé."
      />
    );
  }

  return (
    <SectionCard
      icon={Wallet}
      title="Paiement & caution"
      accent={depositHoldMissing ? 'red' : depositHoldPlaced ? 'emerald' : 'default'}
      collapsible
    >
      <div className="space-y-3">
        {depositBanner}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Statut réservation</p>
          {props.onStatusChange ? (
            <select
              value={status}
              disabled={props.locked}
              onChange={(e) => props.onStatusChange?.(e.target.value as ReservationStatus)}
              className="mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            >
              {RESERVATION_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <span
              className={`mt-1.5 inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(status, d, paymentCtx)}`}
            >
              {statusDisplayLabel(status, d, paymentCtx)}
              {cancelled && status === 'cancelled' ? ` · ${cancelled}` : ''}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-zinc-400">Location (brut)</p>
            <p className="mt-0.5 text-sm font-bold text-zinc-900">{rentalPrice}</p>
          </div>
          <div className="rounded-xl border border-[#416B9F]/20 bg-[#416B9F]/5 px-3 py-2 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase text-[#416B9F]">Total TTC</p>
            <p className="mt-0.5 text-sm font-bold text-zinc-900">
              {pricing.totalTtcEuros != null ? `${pricing.totalTtcEuros.toFixed(2).replace('.', ',')} €` : '—'}
            </p>
            {pricing.couponApplies && pricing.couponDiscountEuros != null && pricing.couponDiscountEuros > 0 ? (
              <p className="mt-0.5 text-[10px] font-medium text-emerald-700">
                {pricing.couponLabel} · −{pricing.couponDiscountEuros.toFixed(2).replace('.', ',')} €
              </p>
            ) : null}
            {pricing.storeCreditAppliedEuros != null && pricing.storeCreditAppliedEuros > 0 ? (
              <p className="mt-0.5 text-[10px] font-medium text-emerald-700">
                Avoir client · −{pricing.storeCreditAppliedEuros.toFixed(2).replace('.', ',')} €
              </p>
            ) : null}
            {pricing.storedTotalMismatch ? (
              <p className="mt-1 text-[10px] font-medium leading-snug text-amber-700">
                Total enregistré{' '}
                {pricing.storedTotalTtcEuros != null
                  ? `(${pricing.storedTotalTtcEuros.toFixed(2).replace('.', ',')} €)`
                  : ''}{' '}
                obsolète — le recalcul ({pricing.totalTtcEuros?.toFixed(2).replace('.', ',')} €) sera appliqué à la
                prochaine sauvegarde. Cela ne remet pas en cause le paiement déjà encaissé.
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-zinc-400">Caution</p>
            <p className="mt-0.5 text-sm font-bold text-zinc-900">{deposit}</p>
          </div>
        </div>

        {(() => {
          const totalCents =
            pricing.totalTtcEuros != null
              ? Math.round(pricing.totalTtcEuros * 100)
              : props.reservation.totalDueCents != null
                ? props.reservation.totalDueCents
                : null;

          const offlineDueCents = Math.max(0, paymentCtx.offlineDueCents ?? 0);
          const onlineTotalCents = totalCents != null ? Math.max(0, totalCents - offlineDueCents) : null;

          const plan = props.reservation.installmentPlan ?? [];
          const paidFromPlanCents =
            plan.length > 0
              ? plan.reduce((sum, p) => sum + (p.status === 'PAID' ? (p.amountCents ?? 0) : 0), 0)
              : null;
          const paidOnlineCents =
            paidFromPlanCents != null
              ? paidFromPlanCents
              : props.reservation.totalDueCents != null
                ? props.reservation.totalDueCents
                : d.paymentCapturedAt && onlineTotalCents != null
                  ? onlineTotalCents
                  : null;

          if (totalCents == null && paidOnlineCents == null && offlineDueCents === 0) return null;

          const onlineRemainingCents =
            onlineTotalCents != null && paidOnlineCents != null
              ? Math.max(0, onlineTotalCents - paidOnlineCents)
              : onlineTotalCents != null
                ? onlineTotalCents
                : null;
          const remainingCents =
            onlineRemainingCents != null ? onlineRemainingCents + offlineDueCents : offlineDueCents > 0 ? offlineDueCents : null;
          const showRemaining = remainingCents != null && remainingCents > 0;
          return (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase text-emerald-800">Payé</p>
                <p className="mt-0.5 text-sm font-bold text-zinc-900">{fmtEurosFromCents(paidOnlineCents)}</p>
                {offlineDueCents > 0 ? (
                  <p className="mt-0.5 text-[10px] font-medium text-emerald-800/80">En ligne uniquement</p>
                ) : null}
              </div>
              <div
                className={[
                  'rounded-xl border px-3 py-2',
                  showRemaining ? 'border-amber-200/70 bg-amber-50/60' : 'border-zinc-200/70 bg-zinc-50/60',
                ].join(' ')}
              >
                <p
                  className={[
                    'text-[10px] font-semibold uppercase',
                    showRemaining ? 'text-amber-800' : 'text-zinc-500',
                  ].join(' ')}
                >
                  Reste à payer
                </p>
                <p className="mt-0.5 text-sm font-bold text-zinc-900">{fmtEurosFromCents(remainingCents)}</p>
                {offlineDueCents > 0 ? (
                  <p className="mt-0.5 text-[10px] font-medium text-amber-800/80">
                    Dont {fmtEurosFromCents(offlineDueCents)} à régler sur place
                  </p>
                ) : null}
              </div>
            </div>
          );
        })()}

        <InfoRow icon={Banknote} label="Canal" value={payment} />
        <InfoRow icon={Tag} label="Coupon" value={coupon} />
        {d.airbusBadge?.trim() ? (
          <InfoRow icon={Tag} label="Badge Airbus" value={d.airbusBadge.trim().toUpperCase()} />
        ) : null}
        {pricing.couponLabel && pricing.couponLabel !== 'Coupon non appliqué' ? (
          <InfoRow icon={Tag} label="Réduction coupon" value={pricing.couponLabel} />
        ) : null}
        <InfoRow icon={Tag} label="Remise manuelle" value={manual} />
        <InfoRow icon={Calendar} label="Échéances" value={`${d.installments} fois`} />
        {props.reservation.installmentPlan && props.reservation.installmentPlan.length >= 2 ? (
          <InstallmentPlanRows reservation={props.reservation} locked={props.locked} />
        ) : null}
        <InfoRow icon={CircleCheck} label="Paiement encaissé" value={paymentCaptured} />
        <InfoRow icon={ShieldCheck} label="Caution encaissée (suivi manuel)" value={depositCaptured} />
        <InfoRow icon={Send} label="Email confirmation" value={mailSent} />
        {refundsTotal > 0 ? (
          <InfoRow icon={Undo2} label="Total remboursé" value={`${refundsTotal.toFixed(2)} €`} />
        ) : null}
        {refunds.length > 0 ? (
          <ul className="space-y-1 rounded-xl border border-zinc-100 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-700">
            {refunds.map((ref) => (
              <li key={ref.id}>
                {Number(ref.amount).toFixed(2)} € · {new Date(ref.at).toLocaleString('fr-FR')}
                {ref.note ? ` — ${ref.note}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
        {d.settlementNote?.trim() ? (
          <InfoRow
            icon={AlertCircle}
            label="Note règlement"
            value={<span className="whitespace-pre-wrap font-normal">{d.settlementNote}</span>}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}

function PricingBlock(
  props: Readonly<{
    reservation: Reservation;
    onStatusChange?: (status: ReservationStatus) => void;
    locked?: boolean;
  }>,
) {
  if (!props.reservation.details) return null;
  return (
    <PricingBlockPresent
      reservation={props.reservation}
      stripeDepositPaymentIntentId={props.reservation.stripeDepositPaymentIntentId}
      onStatusChange={props.onStatusChange}
      locked={props.locked}
    />
  );
}

function ReservationBlock(props: Readonly<{ reservation: Reservation; extrasLabel: ReactNode }>) {
  const r = props.reservation;
  const d = r.details ?? null;
  const periodShort = sameCalendarDay(r.start, r.end)
    ? `${fmtDateLong(r.start)} · ${fmtTime(r.start)} — ${fmtTime(r.end)}`
    : `${fmtDateLong(r.start)} ${fmtTime(r.start)} → ${fmtDateLong(r.end)} ${fmtTime(r.end)}`;
  if (!d) {
    return (
      <SectionCard icon={Calendar} title="Créneau" accent="sky" collapsible>
        <InfoRow icon={Tag} label="Libellé" value={r.title} />
        <InfoRow icon={Clock} label="Période" value={periodShort} />
        <InfoRow icon={Package} label="Extras" value={props.extrasLabel ?? '—'} />
      </SectionCard>
    );
  }
  return <ReservationBlockPresent reservation={r} details={d} extrasLabel={props.extrasLabel} />;
}

function ReservationIconActions(props: Readonly<{
  reservation: Reservation;
  details: Reservation['details'] | null;
  locked?: boolean;
  lockTitle?: string | null;
  onEdit?: (id: string) => void;
  onPatch: (id: string, patch: Partial<ReservationWizardDetails>) => void;
  onResendEmail: (id: string) => Promise<void>;
  onSendContractEmail: (id: string) => Promise<void>;
  onResendSignedContractEmail: (id: string) => Promise<void>;
  onPreviewContract: (id: string) => Promise<void>;
  onDownloadContract: (id: string) => Promise<void>;
  onDownloadRefundReceipt?: (id: string) => Promise<void>;
  onSyncStripe?: (id: string) => Promise<void>;
  onRefund: (id: string) => void;
  onCancel: (id: string) => void;
  onRestore: (id: string) => void;
}>) {
  const {
    reservation: r,
    details,
    locked,
    lockTitle,
    onEdit,
    onPatch,
    onResendEmail,
    onSendContractEmail,
    onResendSignedContractEmail,
  onPreviewContract,
  onDownloadContract,
  onDownloadRefundReceipt,
  onSyncStripe,
    onRefund,
    onCancel,
    onRestore,
  } = props;
  /** Infobulle courte sur boutons grisés (le détail est dans la bannière). */
  const disabledHint = lockTitle?.includes('Contrat signé')
    ? 'Contrat signé — action indisponible'
    : (lockTitle ?? 'Modification bloquée');
  const isOffline = details?.paymentChannel === 'offline';
  const pendingOnline =
    !isOffline && resolveReservationStatus(details) === 'pending_payment';
  const cancelled = isReservationCancelled(details);
  const status = resolveReservationStatus(details);
  const paymentCtx = { installmentPlan: r.installmentPlan };
  const isFullyPaid = isReservationFullyPaid(paymentCtx, details);
  const hasAnyPayment = isFullyPaid || Boolean(details?.paymentCapturedAt) || status === 'reserved_paid';
  const isPaid = hasAnyPayment;
  const hasDeposit = Boolean(details?.depositAmount?.trim());
  const depositHoldPlaced = Boolean(r.stripeDepositPaymentIntentId);
  const depositHoldMissing = !isOffline && isPaid && hasDeposit && !depositHoldPlaced;
  const contractSigned = Boolean(r.rentalContractSigned);
  const refunds = Array.isArray(details?.refunds) ? details.refunds : [];
  const hasRefunds =
    status === 'refunded' || status === 'partially_refunded' || refunds.length > 0;
  /** Verrouillage édition (pas les emails / PDF après signature). */
  const dataLocked = locked;
  const contractDownloadTone = contractSigned ? 'success' : 'default';
  const contractDownloadLabel = contractSigned
    ? 'Télécharger le contrat signé (PDF)'
    : 'Télécharger le contrat (PDF)';
  const icon = 'h-4 w-4 shrink-0';

  let depositTone: 'success' | 'warning' | 'default' = 'default';
  if (depositHoldPlaced) depositTone = 'success';
  else if (depositHoldMissing) depositTone = 'warning';

  const DepositIcon = depositHoldMissing ? ShieldAlert : depositHoldPlaced ? ShieldCheck : Shield;

  return (
    <div
      className="relative z-10 flex shrink-0 flex-wrap items-center justify-end gap-1 overflow-visible pb-1"
      role="toolbar"
      aria-label="Actions réservation"
    >
      {onEdit ? (
        <IconActionButton
          label={dataLocked ? disabledHint : 'Modifier la réservation'}
          tone={dataLocked ? 'muted' : 'active'}
          disabled={dataLocked}
          onClick={() => onEdit(r.id)}
        >
          <Pencil className={icon} strokeWidth={2} aria-hidden />
        </IconActionButton>
      ) : null}

      <IconActionButton
        label={
          dataLocked
            ? disabledHint
            : isFullyPaid
              ? 'Paiement encaissé'
              : hasAnyPayment
                ? 'Acompte réglé'
                : 'Marquer paiement encaissé'
        }
        tone={dataLocked ? 'muted' : hasAnyPayment ? 'success' : 'default'}
        disabled={dataLocked}
        onClick={() => onPatch(r.id, statusAfterPaymentCaptured())}
      >
        {isPaid ? (
          <CircleCheck className={icon} strokeWidth={2} aria-hidden />
        ) : (
          <Banknote className={icon} strokeWidth={2} aria-hidden />
        )}
      </IconActionButton>

      <IconActionButton
        label={
          dataLocked
            ? disabledHint
            : depositHoldPlaced
              ? 'Empreinte caution'
              : depositHoldMissing
                ? 'Empreinte caution manquante'
                : 'Marquer caution encaissée (manuel)'
        }
        tone={dataLocked ? 'muted' : depositTone}
        disabled={dataLocked}
        onClick={() => onPatch(r.id, { depositCapturedAt: new Date().toISOString() })}
      >
        <DepositIcon className={icon} strokeWidth={2} aria-hidden />
      </IconActionButton>

      <IconActionButton
        label={
          !isPaid
            ? 'Paiement non encaissé'
            : locked
              ? 'Résolution client (réservation clôturée)'
              : 'Résolution client — déplacer, avoir ou rembourser'
        }
        tone={!isPaid ? 'muted' : locked ? 'warning' : 'default'}
        disabled={!isPaid}
        onClick={() => onRefund(r.id)}
      >
        <Undo2 className={icon} strokeWidth={2} aria-hidden />
      </IconActionButton>

      {!isOffline ? (
        <IconActionButton
          label={dataLocked ? disabledHint : 'Renvoyer email paiement'}
          tone={dataLocked ? 'muted' : 'default'}
          disabled={dataLocked}
          onClick={() => void onResendEmail(r.id)}
        >
          <Send className={icon} strokeWidth={2} aria-hidden />
        </IconActionButton>
      ) : null}

      {!contractSigned ? (
        <IconActionButton
          label={dataLocked ? disabledHint : 'Envoyer lien signature contrat'}
          tone={dataLocked ? 'muted' : 'default'}
          disabled={dataLocked}
          onClick={() => void onSendContractEmail(r.id)}
        >
          <FileText className={icon} strokeWidth={2} aria-hidden />
        </IconActionButton>
      ) : null}

      {contractSigned ? (
        <IconActionButton
          label="Renvoyer PDF signé par email"
          tone="default"
          onClick={() => void onResendSignedContractEmail(r.id)}
        >
          <Mail className={icon} strokeWidth={2} aria-hidden />
        </IconActionButton>
      ) : null}

      <IconActionButton
        label="Aperçu PDF (brouillon)"
        tone="default"
        onClick={() => void onPreviewContract(r.id)}
      >
        <Eye className={icon} strokeWidth={2} aria-hidden />
      </IconActionButton>

      <IconActionButton
        label={contractDownloadLabel}
        tone={contractDownloadTone}
        onClick={() => void onDownloadContract(r.id)}
      >
        <FileDown className={icon} strokeWidth={2} aria-hidden />
      </IconActionButton>

      {hasRefunds && onDownloadRefundReceipt ? (
        <IconActionButton
          label="Télécharger le justificatif de remboursement (PDF)"
          tone="default"
          onClick={() => void onDownloadRefundReceipt(r.id)}
        >
          <Receipt className={icon} strokeWidth={2} aria-hidden />
        </IconActionButton>
      ) : null}

      {pendingOnline && onSyncStripe ? (
        <IconActionButton
          label={dataLocked ? disabledHint : 'Synchroniser paiement Stripe'}
          tone={dataLocked ? 'muted' : depositHoldMissing ? 'warning' : 'active'}
          disabled={dataLocked}
          onClick={() => void onSyncStripe(r.id)}
        >
          <RefreshCw className={icon} strokeWidth={2} aria-hidden />
        </IconActionButton>
      ) : null}

      {canRestoreReservation(details, status) ? (
        <IconActionButton
          label={dataLocked ? disabledHint : 'Rétablir la réservation'}
          tone={dataLocked ? 'muted' : 'success'}
          disabled={dataLocked}
          onClick={() => onRestore(r.id)}
        >
          <RotateCcw className={icon} strokeWidth={2} aria-hidden />
        </IconActionButton>
      ) : !cancelled ? (
        <IconActionButton
          label="Annuler la réservation"
          tone="danger"
          onClick={() => onCancel(r.id)}
        >
          <Ban className={icon} strokeWidth={2} aria-hidden />
        </IconActionButton>
      ) : null}
    </div>
  );
}

function BoatBlock(props: Readonly<{ boat: Boat | null; fleetName: string; boatTypeLabel: string | null; boatIdFallback: string }>) {
  const { boat, fleetName, boatTypeLabel, boatIdFallback } = props;
  return (
    <SectionCard icon={Anchor} title="Bateau" collapsible>
      {boat ? (
        <>
          <InfoRow icon={Anchor} label="Nom" value={boat.name} highlight />
          <InfoRow icon={Tag} label="Marque / modèle" value={`${boat.brand} · ${boat.model}`} />
          <InfoRow icon={Tag} label="Type" value={boatTypeLabel ?? '—'} />
          <InfoRow icon={Users} label="Capacité max" value={String(boat.maxPassengers)} />
          <InfoRow icon={Package} label="Flotille" value={fleetName} />
        </>
      ) : (
        <>
          <InfoRow icon={Anchor} label="ID bateau" value={boatIdFallback} />
          <p className="mt-2 text-sm text-zinc-500">Aucune fiche bateau dans le catalogue.</p>
        </>
      )}
    </SectionCard>
  );
}

function OwnerMinimalReservationView(props: Readonly<{
  reservation: Reservation;
  layout: 'drawer' | 'embedded';
  presence: { present: boolean; phase: 'enter' | 'exit' };
  onClose?: () => void;
}>) {
  const { reservation: r, layout, presence, onClose } = props;
  const periodDate = fmtDateLong(r.start);
  const periodHours = sameCalendarDay(r.start, r.end)
    ? `${fmtTime(r.start)} → ${fmtTime(r.end)}`
    : `${fmtTime(r.start)} (départ) · ${fmtTime(r.end)} (retour)`;

  const content = (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Créneau réservé</p>
        <p className="mt-3 text-sm text-slate-600">
          Consultation limitée : seuls la date et les horaires sont affichés. Pour toute question, contactez Bleu Calanque.
        </p>
        <div className="mt-4 space-y-3">
          <InfoRow icon={Calendar} label="Date" value={periodDate} highlight />
          <InfoRow icon={Clock} label="Horaires" value={periodHours} highlight />
        </div>
      </div>
    </div>
  );

  const header = (
    <div className="flex items-start gap-2 border-b border-zinc-100 px-3 py-2 sm:px-4">
      <div className="min-w-0 flex-1 pt-0.5">
        <p id="resa-detail-title" className="text-sm font-bold tracking-tight text-zinc-900">
          Créneau réservé
        </p>
        <p className="text-[11px] text-zinc-500">Lecture seule</p>
      </div>
      {layout === 'drawer' && onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  );

  if (layout === 'embedded') {
    return (
      <div className="flex max-h-[min(42rem,72vh)] flex-col rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-2 ring-[#416B9F]/15 ring-offset-2">
        {header}
        {content}
      </div>
    );
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-60">
        <button
          type="button"
          className={['absolute inset-0 bg-black/30 bc-animate', presence.phase === 'enter' ? 'bc-overlay-enter' : 'bc-overlay-exit'].join(' ')}
          aria-label="Fermer"
          onClick={onClose}
        />
        <div
          className={[
            'absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl bc-animate',
            presence.phase === 'enter' ? 'bc-panel-enter' : 'bc-panel-exit',
          ].join(' ')}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resa-detail-title"
        >
          {header}
          <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
        </div>
      </div>
    </Portal>
  );
}

export function ReservationDetailsPanel(props: Readonly<{
  layout?: 'drawer' | 'embedded';
  presence?: { present: boolean; phase: 'enter' | 'exit' };
  reservationId: string | null;
  reservations: Reservation[];
  boatsCatalog: Boat[];
  fleetsCatalog: Fleet[];
  ownerReadOnly?: boolean;
  onClose?: () => void;
  onEdit?: (id: string) => void;
  onOpenReservation?: (id: string) => void;
}>) {
  const {
    layout = 'drawer',
    presence = { present: true, phase: 'enter' as const },
    reservationId,
    reservations,
    boatsCatalog,
    fleetsCatalog,
    ownerReadOnly = false,
    onClose,
    onEdit,
    onOpenReservation,
  } = props;
  const extrasCatalog = useExtrasStore((s) => s.extras);
  const members = useMembersStore((s) => s.members);
  const contractTemplates = useSettingsStore((s) => s.contracts);
  const setReservations = useReservationsStore((s) => s.replace);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundMaxEuros, setRefundMaxEuros] = useState<number | null>(null);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [cancelDialogId, setCancelDialogId] = useState<string | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [checkInDone, setCheckInDone] = useState(false);
  const [checkOutDone, setCheckOutDone] = useState(false);
  const fetchReservationStatus = useCheckFlowStore((s) => s.fetchReservationStatus);
  const refreshReservations = useReservationsStore((s) => s.refresh);

  useEffect(() => {
    setRefundOpen(false);
    setRefundMaxEuros(null);
    setEmailFeedback(null);
    setCancelDialogId(null);
  }, [reservationId]);

  useEffect(() => {
    if (!reservationId) return;
    const r = reservations.find((x) => x.id === reservationId);
    setCheckInDone(Boolean(r?.checkInDone));
    setCheckOutDone(Boolean(r?.checkOutDone));
    let cancelled = false;
    void fetchReservationStatus(reservationId).then(({ checkIn, checkOut }) => {
      if (cancelled) return;
      setCheckInDone(Boolean(checkIn));
      setCheckOutDone(Boolean(checkOut));
    });
    return () => {
      cancelled = true;
    };
  }, [reservationId, reservations, fetchReservationStatus]);

  useEffect(() => {
    if (!reservationId) return;
    let intervalId: ReturnType<typeof window.setInterval> | undefined;

    const tick = async () => {
      const current = useReservationsStore.getState().items.find((x) => x.id === reservationId);
      if (!current?.details?.paymentCapturedAt) return;
      if (current.rentalContractSigned) {
        if (intervalId != null) window.clearInterval(intervalId);
        return;
      }
      await refreshReservations();
    };

    void tick();
    intervalId = window.setInterval(() => void tick(), 5_000);
    return () => {
      if (intervalId != null) window.clearInterval(intervalId);
    };
  }, [reservationId, refreshReservations]);

  async function resendConfirmationEmail(id: string) {
    if (!assertEditable(id)) return;
    setEmailFeedback(null);
    try {
      await api.post(`/reservations/${id}/send-confirmation-email`);
      await refreshReservations();
      setEmailFeedback('Email de confirmation renvoyé.');
    } catch (err) {
      setEmailFeedback(extractApiErrorMessage(err, 'Envoi impossible.'));
    }
  }

  async function sendContractEmail(id: string) {
    setEmailFeedback(null);
    try {
      await api.post(`/reservations/${id}/send-contract-email`);
      setEmailFeedback('Email de signature du contrat envoyé.');
    } catch (err) {
      setEmailFeedback(extractApiErrorMessage(err, 'Envoi du contrat impossible.'));
    }
  }

  async function previewContractPdf(id: string) {
    setEmailFeedback(null);
    try {
      const res = await api.get(`/reservations/${id}/rental-contract/preview`, {
        responseType: 'blob',
      });
      const ok = openPdfBlobInNewTab(res.data);
      if (!ok) {
        setEmailFeedback('Autorisez les pop-ups pour afficher l’aperçu PDF.');
        return;
      }
      setEmailFeedback('Aperçu brouillon ouvert dans un nouvel onglet.');
    } catch (err) {
      setEmailFeedback(extractApiErrorMessage(err, 'Aperçu du contrat impossible.'));
    }
  }

  async function downloadSignedContract(id: string) {
    setEmailFeedback(null);
    try {
      const res = await api.get(`/reservations/${id}/rental-contract/download`, {
        responseType: 'blob',
      });
      const filename = filenameFromContentDisposition(
        typeof res.headers['content-disposition'] === 'string' ? res.headers['content-disposition'] : undefined,
        `contrat-location-${id}.pdf`,
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      const kind = res.headers['x-contract-pdf-kind'];
      setEmailFeedback(
        kind === 'preview'
          ? 'Contrat téléchargé (version régénérée à partir des données actuelles).'
          : 'Contrat signé téléchargé.',
      );
    } catch (err) {
      setEmailFeedback(extractApiErrorMessage(err, 'Téléchargement du contrat impossible.'));
    }
  }

  async function downloadRefundReceipt(id: string) {
    setEmailFeedback(null);
    try {
      const res = await api.get(`/reservations/${id}/refund-receipt/download`, {
        responseType: 'blob',
      });
      const filename = filenameFromContentDisposition(
        typeof res.headers['content-disposition'] === 'string' ? res.headers['content-disposition'] : undefined,
        `justificatif-remboursement-${id}.pdf`,
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setEmailFeedback('Justificatif de remboursement téléchargé.');
    } catch (err) {
      setEmailFeedback(extractApiErrorMessage(err, 'Téléchargement du justificatif impossible.'));
    }
  }

  async function resendSignedContractEmail(id: string) {
    setEmailFeedback(null);
    try {
      await api.post(`/reservations/${id}/rental-contract/resend-signed-email`);
      setEmailFeedback('Email avec le PDF signé renvoyé au client.');
    } catch (err) {
      setEmailFeedback(extractApiErrorMessage(err, 'Envoi du PDF signé impossible.'));
    }
  }

  async function syncStripePayment(id: string) {
    if (!assertEditable(id)) return;
    setEmailFeedback(null);
    try {
      const { data } = await api.post<{
        stripeRefundSync?: { importedCents: number; status: string | null };
      }>(`/reservations/${id}/sync-stripe-payment`);
      await refreshReservations();
      const imported = data?.stripeRefundSync?.importedCents ?? 0;
      if (imported > 0) {
        setEmailFeedback(
          `Synchronisé — remboursement Stripe ${(imported / 100).toFixed(2).replace('.', ',')} € importé (statut mis à jour).`,
        );
      } else {
        setEmailFeedback('Paiement Stripe synchronisé — statut mis à jour.');
      }
    } catch (err) {
      setEmailFeedback(extractApiErrorMessage(err, 'Synchronisation impossible.'));
    }
  }

  function reservationForLock(id: string): Reservation | null {
    const base = reservations.find((x) => x.id === id);
    if (!base) return null;
    return { ...base, checkInDone, checkOutDone };
  }

  function assertEditable(id: string): boolean {
    const r = reservationForLock(id);
    if (!r || !isReservationLockedFromReservation(r)) return true;
    setEmailFeedback(getReservationLockMessageFromReservation(r));
    return false;
  }

  function patchDetails(id: string, patch: Partial<ReservationWizardDetails>) {
    if (!assertEditable(id)) return;
    setReservations((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        const merged = {
          ...(x.details ?? ({} as ReservationWizardDetails)),
          ...syncStatusFields(patch),
        };
        const nextDetails: ReservationWizardDetails = {
          ...merged,
          status: resolveReservationStatus(merged),
        };
        return { ...x, details: nextDetails };
      }),
    );
  }

  function setReservationStatus(id: string, status: ReservationStatus) {
    patchDetails(id, syncStatusFields({ status }));
  }

  function setDocumentValidation(reservationId: string, label: string, validated: boolean) {
    const target = reservations.find((x) => x.id === reservationId);
    const current = target?.details?.contractDocumentValidations ?? {};
    const next = { ...current };
    if (validated) {
      next[label] = { validatedAt: new Date().toISOString() };
    } else {
      delete next[label];
    }
    patchDetails(reservationId, { contractDocumentValidations: next });
  }

  function openRefundForm(id: string) {
    const target = reservations.find((x) => x.id === id);
    if (!target) return;
    const status = resolveReservationStatus(target.details);
    const paid =
      Boolean(target.details?.paymentCapturedAt) ||
      status === 'reserved_paid' ||
      status === 'refunded' ||
      status === 'partially_refunded';
    if (!paid && target.details?.paymentChannel !== 'offline') {
      setEmailFeedback('Remboursement possible après encaissement du paiement (ou synchronisation Stripe).');
      return;
    }
    const existingRefunds = Array.isArray(target.details?.refunds) ? target.details.refunds : [];
    const already = existingRefunds.reduce((s, r) => s + Number(r.amount || 0), 0);
    const paidOnline =
      target.totalDueCents != null && target.totalDueCents > 0
        ? target.totalDueCents / 100
        : null;
    const rental = Number.parseFloat(String(target.details?.rentalPrice ?? '').replace(',', '.'));
    const capEuros =
      paidOnline != null
        ? paidOnline
        : Number.isFinite(rental)
          ? rental
          : 0;
    setRefundMaxEuros(capEuros > 0 ? Math.max(0, capEuros - already) : null);
    setRefundOpen(true);
  }

  async function handleResolutionSuccess(message: string) {
    await refreshReservations();
    void useCouponsStore.getState().refresh();
    void useNotificationsStore.getState().pollServerNotifications();
    setEmailFeedback(message);
  }

  function openCancelDialog(id: string) {
    setCancelDialogId(id);
    setEmailFeedback(null);
  }

  async function submitCancelReservation(payload: { reason: string; notifyClient: boolean }) {
    const id = cancelDialogId;
    if (!id) return;
    setCancelSubmitting(true);
    setEmailFeedback(null);
    try {
      const { data } = await api.post<{ emailSent?: boolean; emailError?: string | null }>(
        `/reservations/${id}/cancel`,
        { reason: payload.reason || undefined, notifyClient: payload.notifyClient },
      );
      await refreshReservations();
      void useCouponsStore.getState().refresh();
      setCancelDialogId(null);
      if (payload.notifyClient && data?.emailSent) {
        setEmailFeedback('Réservation annulée — e-mail envoyé au client.');
      } else if (payload.notifyClient && data?.emailError) {
        setEmailFeedback(`Réservation annulée. E-mail non envoyé : ${data.emailError}`);
      } else if (payload.notifyClient) {
        setEmailFeedback('Réservation annulée — e-mail envoyé au client.');
      } else {
        setEmailFeedback('Réservation annulée.');
      }
    } catch (err) {
      setEmailFeedback(extractApiErrorMessage(err, 'Annulation impossible.'));
    } finally {
      setCancelSubmitting(false);
    }
  }

  async function restoreReservation(id: string) {
    setEmailFeedback(null);
    try {
      const { data } = await api.post<{ couponRedemptionRestored?: boolean }>(`/reservations/${id}/restore`);
      await refreshReservations();
      void useCouponsStore.getState().refresh();
      if (data?.couponRedemptionRestored) {
        setEmailFeedback('Réservation rétablie — utilisation du coupon réenregistrée.');
      } else {
        setEmailFeedback('Réservation rétablie.');
      }
    } catch (err) {
      setEmailFeedback(extractApiErrorMessage(err, 'Rétablissement impossible.'));
    }
  }

  if (!reservationId) return null;
  if (layout === 'drawer' && !presence.present) return null;
  const r = reservations.find((x) => x.id === reservationId) ?? null;
  if (!r) return null;

  if (ownerReadOnly) {
    return (
      <OwnerMinimalReservationView
        reservation={r}
        layout={layout}
        presence={presence}
        onClose={onClose}
      />
    );
  }

  const rForLock: Reservation = { ...r, checkInDone, checkOutDone };
  const calendarLocked = isReservationLockedFromReservation(rForLock);
  const locked = calendarLocked;
  const calendarLockMessage = getReservationLockMessageFromReservation(rForLock);
  const lockMessage = calendarLocked ? calendarLockMessage : null;
  const contractStatus = r.rentalContractStatus;

  const linkedId = r.details?.linkedMemberId?.trim();
  const linkedMember = linkedId ? members.find((m) => m.id === linkedId) : undefined;
  const linkedMemberLabel = linkedMember ? `${linkedMember.firstName} ${linkedMember.lastName}`.trim() : null;
  const activeContractTemplate =
    contractTemplates.find((c) => c.active) ??
    contractTemplates.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const contractRequiredDocumentsBase = activeContractTemplate?.requiredDocuments ?? [];

  const boat = boatsCatalog.find((b) => b.id === r.boatId) ?? null;
  const fleetName = boat?.fleetId ? fleetsCatalog.find((f) => f.id === boat.fleetId)?.name ?? '—' : 'Sans flotille';
  const boatTypeLabel = boat ? (BOAT_TYPES_UI.find((t) => t.value === boat.boatType)?.label ?? boat.boatType) : null;

  const d = r.details ?? null;
  const couponCode = (d?.couponCode ?? '').trim().toUpperCase();
  const contractRequiredDocuments =
    couponCode.includes('AIRBUS') && !contractRequiredDocumentsBase.some((x) => /airbus|badge/i.test(x))
      ? [...contractRequiredDocumentsBase, 'Badge Airbus']
      : contractRequiredDocumentsBase;
  const extrasSelectedIds = Object.entries(d?.extras ?? {}).filter(([, v]) => Boolean(v)).map(([id]) => id);
  const extrasSelected = extrasCatalog.filter((e) => extrasSelectedIds.includes(e.id));
  const extrasLabelText =
    extrasSelected.length > 0
      ? extrasSelected
          .map((e) => e.name)
          .filter(Boolean)
          .join(', ') || extrasSelectedIds.join(', ')
      : null;
  const extrasLabelNode = extrasLabelText ? <span className="whitespace-pre-wrap">{extrasLabelText}</span> : '—';

  const status = d ? resolveReservationStatus(d) : null;
  const summaryTitle = r.title || linkedMemberLabel || 'Réservation';

  const detailBlocks = (
    <>
      <div className={`rounded-2xl border px-4 py-3 shadow-sm ${reservationSummaryCardClass(status, d)}`}>
        <p className="text-base font-bold text-zinc-900">{summaryTitle}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            {fmtDateLong(r.start)}
          </span>
          <span className="text-zinc-300">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {fmtTime(r.start)} — {fmtTime(r.end)}
          </span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {status && d ? (
            <span
              className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(status, d, reservationPaymentContext(r, extrasCatalog))}`}
            >
              {statusDisplayLabel(status, d, reservationPaymentContext(r, extrasCatalog))}
            </span>
          ) : null}
          {contractStatus ? <RentalContractStatusBadge status={contractStatus} /> : null}
        </div>
        {boat ? (
          <p className="mt-2 text-sm font-medium text-[#416B9F]">
            <Anchor className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            {boat.name}
          </p>
        ) : null}
      </div>

      <PricingBlock
        reservation={rForLock}
        locked={locked}
        onStatusChange={locked ? undefined : (status) => setReservationStatus(r.id, status)}
      />
      <ReservationBlock reservation={r} extrasLabel={extrasLabelNode} />
      <ClientBlock
        details={d}
        linkedMemberLabel={linkedMemberLabel}
        reservationId={r.id}
        onOpenReservation={onOpenReservation}
      />
      {d ? (
        <ContractDocumentsChecklist
          requiredDocuments={contractRequiredDocuments}
          details={d}
          linkedMember={linkedMember}
          locked={locked}
          onValidate={(label, validated) => setDocumentValidation(r.id, label, validated)}
        />
      ) : null}
      <BoatBlock boat={boat} fleetName={fleetName} boatTypeLabel={boatTypeLabel} boatIdFallback={r.boatId} />
      <ReservationCheckFlowBlock reservationId={r.id} />
    </>
  );

  const headerNotices =
    r.rentalContractDataStale || lockMessage ? (
      <div className="space-y-0 border-t border-zinc-100">
        {r.rentalContractDataStale ? (
          <p className="break-words border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-relaxed text-amber-950 sm:px-4">
            Données modifiées depuis la signature : le PDF archivé fait foi. Nouvelle signature requise pour
            mettre à jour le contrat.
          </p>
        ) : null}
        {lockMessage ? (
          <p
            className={[
              'break-words px-3 py-2 text-xs font-medium leading-relaxed sm:px-4',
              'border-b',
              reservationLockAlertClass(status, locked),
            ].join(' ')}
          >
            {lockMessage}
          </p>
        ) : null}
      </div>
    ) : null;

  const header = (
    <div
      className={
        layout === 'embedded'
          ? 'overflow-visible border-b border-zinc-100 bg-white'
          : 'sticky top-0 z-30 shrink-0 overflow-visible border-b border-zinc-200/80 bg-white/95 backdrop-blur'
      }
    >
      <div className="flex items-start gap-2 px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1 pt-0.5">
          <p id="resa-detail-title" className="text-sm font-bold tracking-tight text-zinc-900">
            Détail réservation
          </p>
          <p className="text-[11px] text-zinc-500">Actions rapides — survolez une icône pour le libellé</p>
        </div>
        {layout === 'drawer' && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
      {headerNotices}
      <div className="relative z-40 overflow-visible border-t border-zinc-100 px-3 pb-3 pt-2 sm:px-4">
        <ReservationIconActions
          reservation={rForLock}
          details={d}
          locked={locked}
          lockTitle={lockMessage}
          onEdit={locked ? undefined : onEdit}
          onPatch={patchDetails}
          onResendEmail={resendConfirmationEmail}
          onSendContractEmail={sendContractEmail}
          onResendSignedContractEmail={resendSignedContractEmail}
          onPreviewContract={previewContractPdf}
          onDownloadContract={downloadSignedContract}
          onDownloadRefundReceipt={downloadRefundReceipt}
          onSyncStripe={syncStripePayment}
          onRefund={openRefundForm}
          onCancel={openCancelDialog}
          onRestore={(rid) => void restoreReservation(rid)}
        />
      </div>
    </div>
  );

  const alerts = (
    <>
      {emailFeedback ? (
        <p className="shrink-0 border-b border-zinc-200/80 bg-sky-50 px-4 py-2 text-xs font-medium text-sky-800">
          {emailFeedback}
        </p>
      ) : null}
      {refundOpen && r ? (
        <ReservationResolutionPanel
          reservation={r}
          boats={boatsCatalog}
          maxRefundEuros={refundMaxEuros}
          onClose={() => setRefundOpen(false)}
          onSuccess={(message) => void handleResolutionSuccess(message)}
        />
      ) : null}
    </>
  );

  const body = (
    <div className={layout === 'embedded' ? 'space-y-0' : 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden'}>
      <div className={layout === 'embedded' ? 'space-y-4 p-4 sm:p-5' : 'space-y-4 px-4 py-4'}>{detailBlocks}</div>
    </div>
  );

  const cancelTarget = cancelDialogId ? reservations.find((x) => x.id === cancelDialogId) : null;
  const cancelClientLabel = cancelTarget
    ? [cancelTarget.details?.clientFirstName, cancelTarget.details?.clientLastName].filter(Boolean).join(' ') ||
      cancelTarget.details?.clientEmail ||
      cancelTarget.title
    : '';
  const cancelBoatLabel =
    cancelTarget ? (boatsCatalog.find((b) => b.id === cancelTarget.boatId)?.name ?? 'Bateau') : '';

  const cancelDialog = (
    <CancelReservationDialog
      open={cancelDialogId !== null}
      clientLabel={cancelClientLabel}
      boatLabel={cancelBoatLabel}
      onConfirm={(p) => void submitCancelReservation(p)}
      onCancel={() => {
        if (!cancelSubmitting) setCancelDialogId(null);
      }}
      loading={cancelSubmitting}
    />
  );

  if (layout === 'embedded') {
    return (
      <>
        <div className="flex max-h-[min(42rem,72vh)] flex-col rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-2 ring-[#416B9F]/15 ring-offset-2">
          <div className="relative z-20 shrink-0 overflow-visible">{header}</div>
          {alerts}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{body}</div>
        </div>
        {cancelDialog}
      </>
    );
  }

  return (
    <>
      <Portal>
        <div className="fixed inset-0 z-60">
          <button
            type="button"
            className={['absolute inset-0 bg-black/30 bc-animate', presence.phase === 'enter' ? 'bc-overlay-enter' : 'bc-overlay-exit'].join(' ')}
            aria-label="Fermer"
            onClick={onClose}
          />

          <div
            className={[
              'absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-visible bg-white shadow-2xl bc-animate',
              presence.phase === 'enter' ? 'bc-panel-enter' : 'bc-panel-exit',
            ].join(' ')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="resa-detail-title"
          >
            {header}
            {alerts}
            {body}
          </div>
        </div>
      </Portal>
      {cancelDialog}
    </>
  );
}

