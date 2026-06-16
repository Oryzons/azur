import { CouponDiscountKind } from '@prisma/client';
import {
  computeExtrasTotalCents,
  rentalDaysBetween,
  seasonYearForAprilSeptember,
  type ExtraLineForPricing,
} from '@bleu-calanque/shared';

export { isDateInAprilSeptemberSeason, seasonYearForAprilSeptember } from '@bleu-calanque/shared';

export function clientKeyFromReservation(r: {
  clientMemberId: string | null;
  clientEmail: string | null;
}): string {
  return r.clientMemberId?.trim() || r.clientEmail?.trim().toLowerCase() || '__guest__';
}

/** Même client : id membre, e-mail ou clé coupon identique. */
export function isSameCouponClient(
  a: { clientMemberId: string | null; clientEmail: string | null },
  b: { clientMemberId: string | null; clientEmail: string | null },
): boolean {
  const idA = a.clientMemberId?.trim();
  const idB = b.clientMemberId?.trim();
  if (idA && idB && idA === idB) return true;
  const emailA = a.clientEmail?.trim().toLowerCase();
  const emailB = b.clientEmail?.trim().toLowerCase();
  if (emailA && emailB && emailA === emailB) return true;
  return clientKeyFromReservation(a) === clientKeyFromReservation(b);
}

export function extrasTotalCents(
  rentalCents: number,
  extras: ExtraLineForPricing[],
  startAt: Date,
  endAt: Date,
): number {
  const rentalDays = rentalDaysBetween(startAt, endAt);
  return computeExtrasTotalCents(rentalCents, extras, rentalDays);
}

export function computeBrutCentsBeforeCoupon(r: {
  rentalPriceCents: number | null;
  discountPercent: number | null;
  startAt: Date;
  endAt: Date;
  extras: ExtraLineForPricing[];
}): number {
  const rental = r.rentalPriceCents ?? 0;
  let total = rental + extrasTotalCents(rental, r.extras, r.startAt, r.endAt);
  const pct = r.discountPercent ?? 0;
  if (pct > 0) total = Math.round((total * (100 - pct)) / 100);
  return Math.max(0, total);
}

export function effectiveDiscountPercentFromCents(brutCents: number, ttcCents: number): number | null {
  if (brutCents <= 0 || ttcCents <= 0) return null;
  const pct = (1 - ttcCents / brutCents) * 100;
  return Math.round(pct * 10) / 10;
}

export function isDegradedDiscountApplied(
  effectivePct: number | null,
  coupon: {
    discountKind: CouponDiscountKind;
    discountValue: number;
    seasonDegradedDiscountValue: number | null;
  },
): boolean {
  if (effectivePct == null || coupon.seasonDegradedDiscountValue == null) return false;
  if (coupon.discountKind !== CouponDiscountKind.PERCENT) return false;
  const degraded = coupon.seasonDegradedDiscountValue;
  const full = coupon.discountValue;
  const distToDegraded = Math.abs(effectivePct - degraded);
  const distToFull = Math.abs(effectivePct - full);
  return distToDegraded < 1.5 && distToDegraded <= distToFull;
}

export function priorSeasonReservationsCount(
  all: { clientMemberId: string | null; clientEmail: string | null; startAt: Date }[],
  current: { clientMemberId: string | null; clientEmail: string | null; startAt: Date },
  seasonYear: number,
): number {
  return all.filter((r) => {
    if (!isSameCouponClient(r, current)) return false;
    return seasonYearForAprilSeptember(r.startAt) === seasonYear && r.startAt.getTime() < current.startAt.getTime();
  }).length;
}
