import { pad2, startOfDay } from '@/pages/calendar/calendarConstants';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import { CALENDAR_STATUS_COLORS, resolveReservationStatus, statusLabel, type ReservationStatus } from '@/lib/reservationStatus';
import { computeReservationPricingBreakdown, euro, type PricingBreakdown } from './pricingTotals';
import type { Coupon } from '@/stores/coupons';
import type { Extra } from '@/stores/extras';
import {
  computeReservationStripeFees,
  installmentPlanCollectedCents,
  isMultiInstallmentPlan,
  isThirdPartyOfflineExtra,
  stripeEffectiveFeePercent,
  type PaymentMethod,
} from '@bleu-calanque/shared';

export const DEFAULT_RENTAL_VAT_RATE = 20;

function finite(n: number, fallback = 0) {
  return Number.isFinite(n) ? n : fallback;
}

function safeReservationTime(r: Reservation) {
  const t = r.start instanceof Date ? r.start.getTime() : new Date(r.start).getTime();
  return Number.isFinite(t) ? t : 0;
}

export type FinancesPeriod = 'day' | 'week' | 'month' | 'year';

export type PaymentMethodKey =
  | 'carte_en_ligne'
  | 'espece'
  | 'virement'
  | 'prelevement'
  | 'cheque'
  | 'carte_hors_ligne'
  | 'hors_ligne_autre'
  | 'en_attente';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  carte_en_ligne: 'Carte en ligne (Stripe)',
  espece: 'Espèces',
  virement: 'Virement',
  prelevement: 'Prélèvement',
  cheque: 'Chèque',
  carte_hors_ligne: 'Carte (hors ligne)',
  hors_ligne_autre: 'Hors ligne (non précisé)',
  en_attente: 'Non encaissé',
};

export const PAYMENT_METHOD_COLORS: Record<PaymentMethodKey, string> = {
  carte_en_ligne: '#416B9F',
  espece: '#16A34A',
  virement: '#7C3AED',
  prelevement: '#EA580C',
  cheque: '#0891B2',
  carte_hors_ligne: '#2563EB',
  hors_ligne_autre: '#A1A1AA',
  en_attente: '#F59E0B',
};

const STATUS_COLORS: Record<ReservationStatus, string> = {
  pending_payment: CALENDAR_STATUS_COLORS.pending_payment,
  reserved_paid: CALENDAR_STATUS_COLORS.reserved,
  cancelled: CALENDAR_STATUS_COLORS.cancelled,
  refunded: CALENDAR_STATUS_COLORS.refunded,
  partially_refunded: CALENDAR_STATUS_COLORS.partially_refunded,
};

export type ReservationFinanceRow = {
  reservation: Reservation;
  breakdown: PricingBreakdown;
  status: ReservationStatus;
  gross: number;
  refunds: number;
  net: number;
  collected: number;
  pending: number;
  paymentMethod: PaymentMethodKey;
  /** Encaissements ventilés par mode (échéances distinctes). */
  collectedByMethod: Partial<Record<PaymentMethodKey, number>>;
  /** Montants encore dus ventilés par mode prévu. */
  pendingByMethod: Partial<Record<PaymentMethodKey, number>>;
  vatTotal: number;
  htTotal: number;
  rentalShare: number;
  extrasShare: number;
  /** Encaissé via Stripe (€). */
  stripeCollected: number;
  /** Frais Stripe (€). */
  stripeFee: number;
  /** Net crédité en banque sur la part Stripe (€). */
  stripeNet: number;
  /** Encaissé hors Stripe (espèces, virement…). */
  offlineCollected: number;
  /** Net reçu en banque / caisse (hors ligne + Stripe net). */
  netInBank: number;
  stripeFeeEstimated: boolean;
};

export type FinancesReport = {
  period: FinancesPeriod;
  rangeLabel: string;
  reservationCount: number;
  pricedCount: number;
  /** CA facturé (hors annulées sans montant) */
  grossRevenue: number;
  netRevenue: number;
  totalRefunds: number;
  totalCollected: number;
  totalPending: number;
  cancelledCount: number;
  cancelledAmount: number;
  discountTotal: number;
  couponDiscountTotal: number;
  vatTotal: number;
  htTotal: number;
  rentalTotal: number;
  extrasTotal: number;
  totalStripeCollected: number;
  totalStripeFees: number;
  totalStripeNet: number;
  totalNetInBank: number;
  stripeEffectiveFeePercent: number | null;
  stripeFeesEstimated: boolean;
  stripeTimeline: { label: string; fees: number; net: number }[];
  byStatus: Record<ReservationStatus, number>;
  byStatusCount: Record<ReservationStatus, number>;
  byPaymentMethod: Record<PaymentMethodKey, number>;
  byPaymentMethodCount: Record<PaymentMethodKey, number>;
  timeline: { label: string; value: number }[];
  rows: ReservationFinanceRow[];
};

function normalizeNote(s: string) {
  return s
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function inferOfflinePaymentMethod(note: string): Exclude<PaymentMethodKey, 'carte_en_ligne' | 'en_attente'> {
  const n = normalizeNote(note);
  if (/espec|cash|liquide/.test(n)) return 'espece';
  if (/virement|vir\b|transfer|iban/.test(n)) return 'virement';
  if (/prelevement|prelev|sepa|debit/.test(n)) return 'prelevement';
  if (/cheque|cheq/.test(n)) return 'cheque';
  if (/carte|cb|terminal|tpe/.test(n)) return 'carte_hors_ligne';
  return 'hors_ligne_autre';
}

export function paymentMethodKeyFromInstallment(method: PaymentMethod): PaymentMethodKey {
  switch (method) {
    case 'ONLINE':
      return 'carte_en_ligne';
    case 'CASH':
      return 'espece';
    case 'TRANSFER':
      return 'virement';
    case 'CHECK':
      return 'cheque';
    case 'CARD_ONSITE':
      return 'carte_hors_ligne';
    default:
      return 'hors_ligne_autre';
  }
}

function paymentMethodKeyForUnpaidInstallment(method: PaymentMethod): PaymentMethodKey {
  if (method === 'ONLINE') return 'en_attente';
  return paymentMethodKeyFromInstallment(method);
}

function scaleMethodAmounts(
  amounts: Partial<Record<PaymentMethodKey, number>>,
  targetTotal: number,
): Partial<Record<PaymentMethodKey, number>> {
  const sum = Object.values(amounts).reduce((s, v) => s + (v ?? 0), 0);
  if (sum <= 0 || targetTotal <= 0) return {};
  if (Math.abs(sum - targetTotal) < 0.01) return amounts;
  const factor = targetTotal / sum;
  const scaled: Partial<Record<PaymentMethodKey, number>> = {};
  for (const [k, v] of Object.entries(amounts) as [PaymentMethodKey, number][]) {
    if (v > 0) scaled[k] = Math.round(v * factor * 100) / 100;
  }
  return scaled;
}

/** Ventile l'encaissé par mode selon les échéances réglées. */
export function buildCollectedByMethod(
  r: Reservation,
  collectedTotal: number,
  breakdown: PricingBreakdown,
): Partial<Record<PaymentMethodKey, number>> {
  const plan = r.installmentPlan ?? [];
  if (isMultiInstallmentPlan(plan)) {
    const out: Partial<Record<PaymentMethodKey, number>> = {};
    for (const p of plan) {
      if (p.status !== 'PAID') continue;
      const key = paymentMethodKeyFromInstallment(p.method);
      out[key] = Math.round(((out[key] ?? 0) + p.amountCents / 100) * 100) / 100;
    }
    return scaleMethodAmounts(out, collectedTotal);
  }

  if (collectedTotal <= 0) return {};
  const method = resolvePaymentMethod(r, breakdown);
  return { [method]: collectedTotal };
}

/** Ventile le reste dû par mode prévu (échéances en attente). */
export function buildPendingByMethod(
  r: Reservation,
  pendingTotal: number,
): Partial<Record<PaymentMethodKey, number>> {
  if (pendingTotal <= 0) return {};
  const plan = r.installmentPlan ?? [];
  if (isMultiInstallmentPlan(plan)) {
    const out: Partial<Record<PaymentMethodKey, number>> = {};
    for (const p of plan) {
      if (p.status === 'PAID') continue;
      const key = paymentMethodKeyForUnpaidInstallment(p.method);
      out[key] = Math.round(((out[key] ?? 0) + p.amountCents / 100) * 100) / 100;
    }
    return scaleMethodAmounts(out, pendingTotal);
  }
  return { en_attente: pendingTotal };
}

function primaryPaymentMethod(
  byMethod: Partial<Record<PaymentMethodKey, number>>,
): PaymentMethodKey {
  const entries = (Object.entries(byMethod) as [PaymentMethodKey, number][]).filter(([, v]) => v > 0);
  if (entries.length === 0) return 'en_attente';
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]![0];
}

const PAYMENT_METHOD_ORDER: PaymentMethodKey[] = [
  'carte_en_ligne',
  'espece',
  'virement',
  'prelevement',
  'cheque',
  'carte_hors_ligne',
  'hors_ligne_autre',
  'en_attente',
];

export function formatPaymentMethodsSummary(
  collectedByMethod: Partial<Record<PaymentMethodKey, number>>,
  pendingByMethod: Partial<Record<PaymentMethodKey, number>>,
): string {
  const parts: string[] = [];
  for (const key of PAYMENT_METHOD_ORDER) {
    const collected = collectedByMethod[key] ?? 0;
    if (collected > 0) parts.push(`${PAYMENT_METHOD_LABELS[key]} ${euro(collected)} €`);
  }
  for (const key of PAYMENT_METHOD_ORDER) {
    const pending = pendingByMethod[key] ?? 0;
    if (pending <= 0) continue;
    if (key === 'en_attente') {
      parts.push(`en attente ${euro(pending)} €`);
    } else {
      parts.push(`${PAYMENT_METHOD_LABELS[key]} (à encaisser) ${euro(pending)} €`);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : PAYMENT_METHOD_LABELS.en_attente;
}

export function resolvePaymentMethod(r: Reservation, _breakdown: PricingBreakdown): PaymentMethodKey {
  const d = r.details;
  if (!d) return 'en_attente';
  const status = resolveReservationStatus(d);
  if (status === 'cancelled') return 'en_attente';

  const plan = r.installmentPlan ?? [];
  if (isMultiInstallmentPlan(plan)) {
    const paid = plan.filter((p) => p.status === 'PAID');
    if (paid.length === 0) {
      return primaryPaymentMethod(buildPendingByMethod(r, 1));
    }
    const out: Partial<Record<PaymentMethodKey, number>> = {};
    for (const p of paid) {
      const key = paymentMethodKeyFromInstallment(p.method);
      out[key] = Math.round(((out[key] ?? 0) + p.amountCents / 100) * 100) / 100;
    }
    return primaryPaymentMethod(out);
  }

  const captured = Boolean(d.paymentCapturedAt);
  if (d.paymentChannel === 'online') {
    return captured ? 'carte_en_ligne' : 'en_attente';
  }
  const offline = inferOfflinePaymentMethod(d.settlementNote ?? '');
  return captured ? offline : offline === 'hors_ligne_autre' ? 'en_attente' : offline;
}

function resolveStripeFeesForRow(r: Reservation, collectedEuros: number) {
  const stripe = computeReservationStripeFees({
    installmentPlan: r.installmentPlan,
    paymentChannel: r.details?.paymentChannel,
    paymentCapturedAt: r.details?.paymentCapturedAt,
    singlePaymentCents:
      (r.installmentPlan?.length ?? 0) === 0
        ? Math.round(collectedEuros * 100)
        : null,
    reservationStripeFeeCents: r.stripeFeeCents,
    reservationStripeNetCents: r.stripeNetCents,
  });
  const stripeCollected = stripe.stripeCollectedCents / 100;
  const stripeFee = stripe.stripeFeeCents / 100;
  const stripeNet = stripe.stripeNetCents / 100;
  const offlineCollected = Math.max(0, Math.round((collectedEuros - stripeCollected) * 100) / 100);
  const netInBank = Math.round((offlineCollected + stripeNet) * 100) / 100;
  return {
    stripeCollected,
    stripeFee,
    stripeNet,
    offlineCollected,
    netInBank,
    stripeFeeEstimated: stripe.estimated,
  };
}

function resolveCollectedEuros(r: Reservation, businessNet: number): number {
  const status = resolveReservationStatus(r.details);
  if (status === 'cancelled') return 0;

  const plan = r.installmentPlan ?? [];
  if (isMultiInstallmentPlan(plan)) {
    return installmentPlanCollectedCents(plan) / 100;
  }

  if (!r.details?.paymentCapturedAt) return 0;
  return businessNet;
}

function vatFromTtc(amountTtc: number, vatRate: number) {
  if (amountTtc <= 0 || vatRate <= 0) return 0;
  return Math.round((amountTtc * (vatRate / (100 + vatRate))) * 100) / 100;
}

function computeExtrasVat(
  r: Reservation,
  extrasCatalog: Extra[],
  rentalAfterDiscount: number,
): { extrasTtc: number; extrasVat: number } {
  const d = r.details;
  if (!d) return { extrasTtc: 0, extrasVat: 0 };
  const selectedIds = new Set(Object.entries(d.extras ?? {}).filter(([, v]) => Boolean(v)).map(([id]) => id));
  const selected = extrasCatalog
    .filter((e) => e.enabled && selectedIds.has(e.id))
    .filter((e) => !isThirdPartyOfflineExtra({ name: e.name, icon: e.icon, paymentChannel: e.paymentChannel }));
  const start = r.start;
  let end = r.end;
  if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + 3600000);
  const rentalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const mult = (u: Extra['billingUnit']) => {
    if (u === 'location') return 1;
    if (u === 'jour') return rentalDays;
    return Math.max(1, Math.ceil(rentalDays / 7));
  };

  let extrasTtc = 0;
  let extrasVat = 0;
  for (const e of selected) {
    let line = 0;
    if (e.priceKind === 'euro') line = e.priceValue * mult(e.billingUnit);
    else line = rentalAfterDiscount * (e.priceValue / 100) * mult(e.billingUnit);
    line = Math.round(line * 100) / 100;
    extrasTtc += line;
    extrasVat += vatFromTtc(line, e.vatRate);
  }
  return { extrasTtc: Math.round(extrasTtc * 100) / 100, extrasVat: Math.round(extrasVat * 100) / 100 };
}

function buildRow(
  r: Reservation,
  extrasCatalog: Extra[],
  couponsCatalog: Coupon[],
  allReservations: readonly Reservation[],
): ReservationFinanceRow | null {
  const breakdown = computeReservationPricingBreakdown(r, extrasCatalog, couponsCatalog, allReservations);
  const status = resolveReservationStatus(r.details);
  if (!breakdown.ok) {
    if (r.totalDueCents && r.totalDueCents > 0 && status !== 'cancelled') {
      const net = Math.round((r.totalDueCents / 100) * 100) / 100;
      const collected = Math.min(resolveCollectedEuros(r, net), net);
      const pending = Math.max(0, Math.round((net - collected) * 100) / 100);
      const collectedByMethod = buildCollectedByMethod(r, collected, breakdown);
      const pendingByMethod = buildPendingByMethod(r, pending);
      const stripeFees = resolveStripeFeesForRow(r, collected);
      return {
        reservation: r,
        breakdown,
        status,
        gross: net,
        refunds: 0,
        net,
        collected,
        pending,
        paymentMethod: primaryPaymentMethod({ ...collectedByMethod, ...pendingByMethod }),
        collectedByMethod,
        pendingByMethod,
        vatTotal: vatFromTtc(net, DEFAULT_RENTAL_VAT_RATE),
        htTotal: net - vatFromTtc(net, DEFAULT_RENTAL_VAT_RATE),
        rentalShare: net,
        extrasShare: 0,
        ...stripeFees,
      };
    }
    return null;
  }

  const gross = finite(breakdown.final);
  const refunds = finite(breakdown.refunds);
  const net = Math.max(0, finite(Math.round((gross - refunds) * 100) / 100));
  const collectedRaw = status === 'cancelled' ? 0 : resolveCollectedEuros(r, net);
  const collected = Math.min(collectedRaw, net);
  const pending = status === 'cancelled' ? 0 : Math.max(0, Math.round((net - collected) * 100) / 100);

  const manualFactor = 1 - breakdown.manualDiscPct / 100;
  const rentalAfterManual = breakdown.rental * manualFactor;
  const extrasAfterManual = breakdown.extras * manualFactor;
  let rentalAfterCoupon = rentalAfterManual;
  const extrasAfterCoupon = extrasAfterManual;
  if (breakdown.coupon?.applied) {
    if (breakdown.coupon.kind === 'percent') {
      rentalAfterCoupon *= 1 - breakdown.coupon.effectiveValue / 100;
    } else {
      rentalAfterCoupon = Math.max(0, rentalAfterManual - breakdown.coupon.effectiveValue);
    }
  }

  const rentalVat = vatFromTtc(rentalAfterCoupon, DEFAULT_RENTAL_VAT_RATE);
  const { extrasVat } = computeExtrasVat(r, extrasCatalog, extrasAfterCoupon);
  const vatTotal = Math.round((rentalVat + extrasVat) * 100) / 100;
  const htTotal = Math.round((net - vatTotal) * 100) / 100;
  const stripeFees =
    status === 'cancelled'
      ? {
          stripeCollected: 0,
          stripeFee: 0,
          stripeNet: 0,
          offlineCollected: 0,
          netInBank: 0,
          stripeFeeEstimated: false,
        }
      : resolveStripeFeesForRow(r, collected);
  const collectedByMethod =
    status === 'cancelled' ? {} : buildCollectedByMethod(r, collected, breakdown);
  const pendingByMethod = status === 'cancelled' ? {} : buildPendingByMethod(r, pending);

  return {
    reservation: r,
    breakdown,
    status,
    gross,
    refunds,
    net: status === 'cancelled' ? 0 : net,
    collected,
    pending,
    paymentMethod: primaryPaymentMethod({ ...collectedByMethod, ...pendingByMethod }),
    collectedByMethod,
    pendingByMethod,
    vatTotal: status === 'cancelled' ? 0 : vatTotal,
    htTotal: status === 'cancelled' ? 0 : htTotal,
    rentalShare: breakdown.rental,
    extrasShare: breakdown.extras,
    ...stripeFees,
  };
}

function emptyStatusRecord(): Record<ReservationStatus, number> {
  return {
    pending_payment: 0,
    reserved_paid: 0,
    cancelled: 0,
    refunded: 0,
    partially_refunded: 0,
  };
}

function emptyPaymentRecord(): Record<PaymentMethodKey, number> {
  return {
    carte_en_ligne: 0,
    espece: 0,
    virement: 0,
    prelevement: 0,
    cheque: 0,
    carte_hors_ligne: 0,
    hors_ligne_autre: 0,
    en_attente: 0,
  };
}

export function getPeriodRange(period: FinancesPeriod, now = new Date()) {
  const dayStart = startOfDay(now);
  if (period === 'day') {
    const end = new Date(dayStart);
    end.setDate(end.getDate() + 1);
    return {
      start: dayStart,
      endExclusive: end,
      label: dayStart.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    };
  }
  if (period === 'week') {
    const d = dayStart.getDay();
    const diff = d === 0 ? -6 : 1 - d;
    const start = new Date(dayStart);
    start.setDate(start.getDate() + diff);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const last = new Date(end);
    last.setDate(last.getDate() - 1);
    return {
      start,
      endExclusive: end,
      label: `Semaine du ${start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} au ${last.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      start,
      endExclusive: end,
      label: start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  return {
    start,
    endExclusive: end,
    label: `Année ${now.getFullYear()}`,
  };
}

/** Décale la date de référence d'une période (jour / semaine / mois / année). */
export function shiftFinancesPeriodAnchor(
  period: FinancesPeriod,
  anchor: Date,
  direction: -1 | 1,
): Date {
  const d = new Date(anchor);
  if (period === 'day') {
    d.setDate(d.getDate() + direction);
    return d;
  }
  if (period === 'week') {
    d.setDate(d.getDate() + 7 * direction);
    return d;
  }
  if (period === 'month') {
    d.setMonth(d.getMonth() + direction);
    return d;
  }
  d.setFullYear(d.getFullYear() + direction);
  return d;
}

/** Vrai si l'ancre pointe sur la période calendaire en cours (pas de « suivant »). */
export function isFinancesPeriodAnchorAtPresent(period: FinancesPeriod, anchor: Date): boolean {
  const present = getPeriodRange(period, new Date());
  const selected = getPeriodRange(period, anchor);
  return present.start.getTime() === selected.start.getTime();
}

export function financesPeriodAnimKey(period: FinancesPeriod, anchor: Date): string {
  const { start } = getPeriodRange(period, anchor);
  return `${period}:${start.toISOString().slice(0, 10)}`;
}

function buildTimeline(
  period: FinancesPeriod,
  range: { start: Date; endExclusive: Date },
  rows: ReservationFinanceRow[],
): { label: string; value: number }[] {
  const byKey = new Map<string, number>();
  for (const row of rows) {
    const d = row.reservation.start;
    let key: string;
    if (period === 'day') {
      key = `${d.getHours()}`;
    } else if (period === 'year') {
      key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    } else {
      key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
    byKey.set(key, (byKey.get(key) ?? 0) + row.collected);
  }

  const points: { label: string; value: number }[] = [];
  if (period === 'day') {
    for (let h = 0; h < 24; h += 3) {
      const vals = [h, h + 1, h + 2].map((hr) => byKey.get(String(hr)) ?? 0);
      points.push({ label: `${pad2(h)}h`, value: Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 });
    }
    return points;
  }

  if (period === 'year') {
    const cur = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    while (cur < range.endExclusive) {
      const key = `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}`;
      points.push({
        label: cur.toLocaleDateString('fr-FR', { month: 'short' }),
        value: Math.round((byKey.get(key) ?? 0) * 100) / 100,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return points;
  }

  const cur = new Date(range.start);
  while (cur < range.endExclusive) {
    const key = `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`;
    const label =
      period === 'month'
        ? cur.toLocaleDateString('fr-FR', { day: '2-digit' })
        : cur.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' });
    points.push({ label, value: Math.round((byKey.get(key) ?? 0) * 100) / 100 });
    cur.setDate(cur.getDate() + 1);
    if (points.length >= 14) break;
  }
  return points;
}

function buildStripeTimeline(
  period: FinancesPeriod,
  range: { start: Date; endExclusive: Date },
  rows: ReservationFinanceRow[],
): { label: string; fees: number; net: number }[] {
  const byKey = new Map<string, { fees: number; net: number }>();
  for (const row of rows) {
    if (row.stripeFee <= 0 && row.stripeNet <= 0) continue;
    const d = row.reservation.start;
    let key: string;
    if (period === 'day') {
      key = `${d.getHours()}`;
    } else if (period === 'year') {
      key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    } else {
      key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
    const prev = byKey.get(key) ?? { fees: 0, net: 0 };
    byKey.set(key, {
      fees: prev.fees + row.stripeFee,
      net: prev.net + row.stripeNet,
    });
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  const points: { label: string; fees: number; net: number }[] = [];

  if (period === 'day') {
    for (let h = 0; h < 24; h += 3) {
      const vals = [h, h + 1, h + 2].map((hr) => byKey.get(String(hr)) ?? { fees: 0, net: 0 });
      points.push({
        label: `${pad2(h)}h`,
        fees: round(vals.reduce((a, b) => a + b.fees, 0)),
        net: round(vals.reduce((a, b) => a + b.net, 0)),
      });
    }
    return points;
  }

  if (period === 'year') {
    const cur = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    while (cur < range.endExclusive) {
      const key = `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}`;
      const v = byKey.get(key) ?? { fees: 0, net: 0 };
      points.push({
        label: cur.toLocaleDateString('fr-FR', { month: 'short' }),
        fees: round(v.fees),
        net: round(v.net),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return points;
  }

  const cur = new Date(range.start);
  while (cur < range.endExclusive) {
    const key = `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`;
    const v = byKey.get(key) ?? { fees: 0, net: 0 };
    const label =
      period === 'month'
        ? cur.toLocaleDateString('fr-FR', { day: '2-digit' })
        : cur.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' });
    points.push({ label, fees: round(v.fees), net: round(v.net) });
    cur.setDate(cur.getDate() + 1);
    if (points.length >= 14) break;
  }
  return points;
}

export function buildFinancesReport(
  reservations: Reservation[],
  range: { start: Date; endExclusive: Date },
  period: FinancesPeriod,
  extrasCatalog: Extra[],
  couponsCatalog: Coupon[],
): FinancesReport {
  const startMs = range.start.getTime();
  const endMs = range.endExclusive.getTime();
  const inRange = reservations.filter((r) => {
    const t = safeReservationTime(r);
    return t >= startMs && t < endMs;
  });
  const rows = inRange
    .map((r) => buildRow(r, extrasCatalog, couponsCatalog, reservations))
    .filter((x): x is ReservationFinanceRow => x !== null);

  const byStatus = emptyStatusRecord();
  const byStatusCount = emptyStatusRecord();
  const byPaymentMethod = emptyPaymentRecord();
  const byPaymentMethodCount = emptyPaymentRecord();

  let grossRevenue = 0;
  let netRevenue = 0;
  let totalRefunds = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let cancelledCount = 0;
  let cancelledAmount = 0;
  let discountTotal = 0;
  let couponDiscountTotal = 0;
  let vatTotal = 0;
  let htTotal = 0;
  let rentalTotal = 0;
  let extrasTotal = 0;
  let totalStripeCollected = 0;
  let totalStripeFees = 0;
  let totalStripeNet = 0;
  let totalNetInBank = 0;
  let stripeFeesEstimated = false;

  for (const row of rows) {
    const { status, breakdown } = row;
    byStatusCount[status] += 1;
    if (status === 'cancelled') {
      cancelledCount += 1;
      if (breakdown.ok) cancelledAmount += breakdown.final;
      continue;
    }

    // Répartir encaissé vs en attente (acompte seul ≠ tout le CA « payé »).
    if (row.collected > 0) {
      const collectedBucket = status === 'pending_payment' ? 'reserved_paid' : status;
      byStatus[collectedBucket] += row.collected;
    }
    if (row.pending > 0) {
      byStatus.pending_payment += row.pending;
    }

    grossRevenue += row.gross;
    netRevenue += row.net;
    totalRefunds += row.refunds;
    totalCollected += row.collected;
    totalPending += row.pending;
    vatTotal += row.vatTotal;
    htTotal += row.htTotal;
    rentalTotal += row.rentalShare;
    extrasTotal += row.extrasShare;
    totalStripeCollected += row.stripeCollected;
    totalStripeFees += row.stripeFee;
    totalStripeNet += row.stripeNet;
    totalNetInBank += row.netInBank;
    if (row.stripeFeeEstimated) stripeFeesEstimated = true;

    for (const [method, amount] of Object.entries(row.collectedByMethod) as [PaymentMethodKey, number][]) {
      if (amount > 0) {
        byPaymentMethod[method] += amount;
        byPaymentMethodCount[method] += 1;
      }
    }
    for (const [method, amount] of Object.entries(row.pendingByMethod) as [PaymentMethodKey, number][]) {
      if (amount > 0) {
        byPaymentMethod[method] += amount;
      }
    }

    if (breakdown.ok) {
      discountTotal += Math.max(0, breakdown.subtotal - breakdown.afterManual);
      if (breakdown.coupon?.applied) {
        couponDiscountTotal += Math.max(0, breakdown.afterManual - breakdown.final);
      }
    }
  }

  const round = (n: number) => finite(Math.round(finite(n) * 100) / 100);

  return {
    period,
    rangeLabel: getPeriodRange(period, range.start).label,
    reservationCount: inRange.length,
    pricedCount: rows.length,
    grossRevenue: round(grossRevenue),
    netRevenue: round(netRevenue),
    totalRefunds: round(totalRefunds),
    totalCollected: round(totalCollected),
    totalPending: round(totalPending),
    cancelledCount,
    cancelledAmount: round(cancelledAmount),
    discountTotal: round(discountTotal),
    couponDiscountTotal: round(couponDiscountTotal),
    vatTotal: round(vatTotal),
    htTotal: round(htTotal),
    rentalTotal: round(rentalTotal),
    extrasTotal: round(extrasTotal),
    totalStripeCollected: round(totalStripeCollected),
    totalStripeFees: round(totalStripeFees),
    totalStripeNet: round(totalStripeNet),
    totalNetInBank: round(totalNetInBank),
    stripeEffectiveFeePercent: stripeEffectiveFeePercent(
      Math.round(totalStripeCollected * 100),
      Math.round(totalStripeFees * 100),
    ),
    stripeFeesEstimated,
    stripeTimeline: buildStripeTimeline(
      period,
      range,
      rows.filter((r) => r.status !== 'cancelled'),
    ),
    byStatus,
    byStatusCount,
    byPaymentMethod,
    byPaymentMethodCount,
    timeline: buildTimeline(period, range, rows.filter((r) => r.status !== 'cancelled')),
    rows: [...rows].sort((a, b) => safeReservationTime(b.reservation) - safeReservationTime(a.reservation)),
  };
}

export function emptyFinancesReport(period: FinancesPeriod, range: { start: Date; endExclusive: Date }): FinancesReport {
  const emptyStatus = emptyStatusRecord();
  const emptyPay = emptyPaymentRecord();
  return {
    period,
    rangeLabel: getPeriodRange(period, range.start).label,
    reservationCount: 0,
    pricedCount: 0,
    grossRevenue: 0,
    netRevenue: 0,
    totalRefunds: 0,
    totalCollected: 0,
    totalPending: 0,
    cancelledCount: 0,
    cancelledAmount: 0,
    discountTotal: 0,
    couponDiscountTotal: 0,
    vatTotal: 0,
    htTotal: 0,
    rentalTotal: 0,
    extrasTotal: 0,
    totalStripeCollected: 0,
    totalStripeFees: 0,
    totalStripeNet: 0,
    totalNetInBank: 0,
    stripeEffectiveFeePercent: null,
    stripeFeesEstimated: false,
    stripeTimeline: [],
    byStatus: emptyStatus,
    byStatusCount: emptyStatus,
    byPaymentMethod: emptyPay,
    byPaymentMethodCount: emptyPay,
    timeline: [],
    rows: [],
  };
}

export function safeBuildFinancesReport(
  reservations: Reservation[],
  range: { start: Date; endExclusive: Date },
  period: FinancesPeriod,
  extrasCatalog: Extra[],
  couponsCatalog: Coupon[],
): FinancesReport {
  try {
    return buildFinancesReport(reservations, range, period, extrasCatalog, couponsCatalog);
  } catch {
    return emptyFinancesReport(period, range);
  }
}

export { STATUS_COLORS, statusLabel };
