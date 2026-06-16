import {
  addDays,
  dayToIso,
  formatTime,
  pad2,
  startOfWeekMonday,
} from '@/pages/calendar/calendarConstants';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import { computeReservationPricingDisplay } from '@/lib/reservationPricingDisplay';
import { resolveReservationStatus, statusLabel } from '@/lib/reservationStatus';
import { computeReservationPricingBreakdown, euro } from '@/pages/finances/pricingTotals';
import type { Boat } from '@/stores/boats';
import type { Coupon } from '@/stores/coupons';
import type { Extra } from '@/stores/extras';
import { downloadBlob } from '@/lib/downloadFile';

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;

export type ComptabiliteRow = {
  reservationId: string;
  boatId: string;
  boatLabel: string;
  dayIso: string;
  dayLabel: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  civility: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  rentalBrut: string;
  discountPct: string;
  couponCode: string;
  couponDiscount: string;
  storeCredit: string;
  extrasOnline: string;
  extrasOffline: string;
  totalTtc: string;
  paymentChannel: string;
  paymentDetail: string;
  refunds: string;
  passengers: string;
  children: string;
  airbusBadge: string;
  internalNote: string;
};

export function weekRangeFromAnchor(anchor: Date): { weekStart: Date; weekEnd: Date } {
  const weekStart = startOfWeekMonday(anchor);
  const weekEnd = addDays(weekStart, 7);
  return { weekStart, weekEnd };
}

export function formatWeekLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `Semaine du ${fmt(weekStart)} au ${fmt(weekEnd)}`;
}

export function reservationOverlapsWeek(r: Reservation, weekStart: Date, weekEnd: Date): boolean {
  return r.start.getTime() < weekEnd.getTime() && r.end.getTime() > weekStart.getTime();
}

function boatLabel(boat: Boat | undefined, boatId: string): string {
  if (!boat) return boatId;
  return boat.name?.trim() || `${boat.brand} ${boat.model}`.trim() || boat.id;
}

function dayLabelFromDate(d: Date): string {
  const dayIndex = (d.getDay() + 6) % 7;
  return DAY_NAMES[dayIndex] ?? '';
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function paymentDetail(r: Reservation): string {
  const plan = r.installmentPlan;
  if (plan?.length) {
    return plan
      .map((i) => `${i.label ?? `Échéance ${i.sequence}`}: ${euro(i.amountCents / 100)} € (${i.status})`)
      .join(' | ');
  }
  const methods = r.details?.installmentMethods;
  if (methods?.length) return methods.join(', ');
  return r.details?.paymentCapturedAt ? 'Payé' : '—';
}

function csvCell(v: string): string {
  const s = String(v ?? '');
  if (/[;"\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .replaceAll(/[^a-zA-Z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48);
}

export function buildComptabiliteRow(
  r: Reservation,
  boat: Boat | undefined,
  extrasCatalog: readonly Extra[],
  coupons: readonly Coupon[],
  allReservations: readonly Reservation[],
): ComptabiliteRow | null {
  const d = r.details;
  if (!d) return null;

  const pricing = computeReservationPricingDisplay(r, extrasCatalog, coupons, allReservations);
  const breakdown = computeReservationPricingBreakdown(r, [...extrasCatalog], [...coupons], allReservations);
  const status = resolveReservationStatus(d);

  const extrasOffline = breakdown.ok ? euro(breakdown.extrasOffline) : '—';
  const couponDiscount =
    breakdown.ok && breakdown.couponDiscountOnRental > 0
      ? euro(breakdown.couponDiscountOnRental)
      : pricing.couponDiscountEuros != null
        ? euro(pricing.couponDiscountEuros)
        : '—';
  const totalTtc =
    pricing.totalTtcEuros != null
      ? euro(pricing.totalTtcEuros)
      : breakdown.ok
        ? euro(breakdown.final)
        : '—';
  const refunds =
    breakdown.ok && breakdown.refunds > 0
      ? euro(breakdown.refunds)
      : d.refunds?.length
        ? euro(d.refunds.reduce((s, x) => s + x.amount, 0))
        : '—';

  return {
    reservationId: r.id,
    boatId: r.boatId,
    boatLabel: boatLabel(boat, r.boatId),
    dayIso: dayToIso(r.start),
    dayLabel: dayLabelFromDate(r.start),
    startDate: fmtDate(r.start),
    startTime: formatTime(r.start),
    endDate: fmtDate(r.end),
    endTime: formatTime(r.end),
    civility: d.civility ?? '',
    firstName: d.clientFirstName ?? '',
    lastName: d.clientLastName ?? '',
    email: d.clientEmail ?? '',
    phone: d.clientPhone ?? '',
    status: statusLabel(status),
    rentalBrut: pricing.rentalBrutEuros != null ? euro(pricing.rentalBrutEuros) : d.rentalPrice || '—',
    discountPct: pricing.manualDiscPct > 0 ? String(pricing.manualDiscPct) : d.discountPercent || '0',
    couponCode: pricing.couponCode ?? d.couponCode ?? '',
    couponDiscount,
    storeCredit: pricing.storeCreditAppliedEuros != null ? euro(pricing.storeCreditAppliedEuros) : '—',
    extrasOnline: breakdown.ok ? euro(Math.max(0, breakdown.extras - breakdown.extrasOffline)) : '—',
    extrasOffline,
    totalTtc,
    paymentChannel: d.paymentChannel === 'online' ? 'En ligne' : 'Hors ligne',
    paymentDetail: paymentDetail(r),
    refunds,
    passengers: String(d.passengerCount ?? ''),
    children: d.hasChildren ? String(d.childrenCount ?? 0) : '0',
    airbusBadge: d.airbusBadge ?? '',
    internalNote: d.internalNote ?? '',
  };
}

export function buildComptabiliteRows(
  reservations: readonly Reservation[],
  boats: readonly Boat[],
  extrasCatalog: readonly Extra[],
  coupons: readonly Coupon[],
  weekStart: Date,
): ComptabiliteRow[] {
  const weekEnd = addDays(weekStart, 7);
  const boatById = new Map(boats.map((b) => [b.id, b]));
  const inWeek = reservations.filter((r) => reservationOverlapsWeek(r, weekStart, weekEnd));

  const rows: ComptabiliteRow[] = [];
  for (const r of inWeek) {
    const row = buildComptabiliteRow(r, boatById.get(r.boatId), extrasCatalog, coupons, reservations);
    if (row) rows.push(row);
  }

  rows.sort((a, b) => {
    const boatCmp = a.boatLabel.localeCompare(b.boatLabel, 'fr');
    if (boatCmp !== 0) return boatCmp;
    const dayCmp = a.dayIso.localeCompare(b.dayIso);
    if (dayCmp !== 0) return dayCmp;
    return a.startTime.localeCompare(b.startTime);
  });

  return rows;
}

export function rowsForBoat(rows: readonly ComptabiliteRow[], boatId: string): ComptabiliteRow[] {
  return rows.filter((r) => r.boatId === boatId);
}

const CSV_HEADERS: (keyof ComptabiliteRow)[] = [
  'dayLabel',
  'startDate',
  'startTime',
  'endDate',
  'endTime',
  'boatLabel',
  'civility',
  'firstName',
  'lastName',
  'email',
  'phone',
  'status',
  'rentalBrut',
  'discountPct',
  'couponCode',
  'couponDiscount',
  'storeCredit',
  'extrasOnline',
  'extrasOffline',
  'totalTtc',
  'paymentChannel',
  'paymentDetail',
  'refunds',
  'passengers',
  'children',
  'airbusBadge',
  'internalNote',
];

const CSV_HEADER_LABELS: Record<keyof ComptabiliteRow, string> = {
  reservationId: 'ID réservation',
  boatId: 'ID bateau',
  boatLabel: 'Bateau',
  dayIso: 'Date ISO',
  dayLabel: 'Jour',
  startDate: 'Date début',
  startTime: 'Heure début',
  endDate: 'Date fin',
  endTime: 'Heure fin',
  civility: 'Civilité',
  firstName: 'Prénom',
  lastName: 'Nom',
  email: 'Email',
  phone: 'Téléphone',
  status: 'Statut',
  rentalBrut: 'Prix location (€)',
  discountPct: 'Remise (%)',
  couponCode: 'Coupon',
  couponDiscount: 'Réduction coupon (€)',
  storeCredit: 'Avoir client (€)',
  extrasOnline: 'Extras en ligne (€)',
  extrasOffline: 'Extras sur place (€)',
  totalTtc: 'Total TTC (€)',
  paymentChannel: 'Canal paiement',
  paymentDetail: 'Détail paiement',
  refunds: 'Remboursements (€)',
  passengers: 'Passagers',
  children: 'Enfants',
  airbusBadge: 'Badge Airbus',
  internalNote: 'Note interne',
};

export function rowsToCsv(rows: readonly ComptabiliteRow[]): string {
  const header = CSV_HEADERS.map((k) => csvCell(CSV_HEADER_LABELS[k])).join(';');
  const body = rows.map((row) => CSV_HEADERS.map((k) => csvCell(row[k])).join(';')).join('\n');
  return `\uFEFF${header}\n${body}`;
}

export function downloadBoatWeekCsv(
  rows: readonly ComptabiliteRow[],
  boat: Boat,
  weekStart: Date,
): void {
  const boatRows = rowsForBoat(rows, boat.id);
  const csv = rowsToCsv(boatRows);
  const slug = slugify(boat.name || boat.brand || 'bateau');
  const weekKey = `${weekStart.getFullYear()}-${pad2(weekStart.getMonth() + 1)}-${pad2(weekStart.getDate())}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `comptabilite-${slug}-semaine-${weekKey}.csv`);
}

export function weekInputValue(weekStart: Date): string {
  const y = weekStart.getFullYear();
  const thursday = addDays(weekStart, 3);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${y}-W${String(weekNo).padStart(2, '0')}`;
}

export function parseWeekInput(value: string): Date | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week)) return null;
  const jan4 = new Date(year, 0, 4);
  const weekStart = startOfWeekMonday(jan4);
  weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
  return weekStart;
}

export function defaultWeekStart(): Date {
  return startOfWeekMonday(new Date());
}
