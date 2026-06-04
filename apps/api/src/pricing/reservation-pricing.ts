import { CouponDiscountKind, type PrismaClient } from '@prisma/client';
import {
  applyManualDiscountCents,
  applyCouponToRentalAndExtrasCents,
  computeExtrasTotalCents,
  rentalDaysBetween,
  type ExtraLineForPricing,
} from '@bleu-calanque/shared';
import { isSameCouponClient, seasonYearForAprilSeptember } from '../coupons/coupon-usage.util';

export type ReservationPricingInput = {
  rentalPriceCents: number | null;
  discountPercent: number | null;
  couponCode: string | null;
  clientMemberId: string | null;
  clientEmail: string | null;
  startAt: Date;
  endAt: Date;
  extras: ExtraLineForPricing[];
};

async function getEffectiveCouponDiscount(
  prisma: PrismaClient,
  couponCode: string,
  client: { clientMemberId: string | null; clientEmail: string | null },
  evaluationDate: Date,
  full: { discountKind: CouponDiscountKind; discountValue: number; seasonMaxFullUsesPerClient: number | null; seasonDegradedDiscountValue: number | null },
): Promise<{ discountKind: CouponDiscountKind; discountValue: number }> {
  if (full.seasonMaxFullUsesPerClient == null || full.seasonDegradedDiscountValue == null) {
    return { discountKind: full.discountKind, discountValue: full.discountValue };
  }
  const seasonY = seasonYearForAprilSeptember(evaluationDate);
  if (seasonY === null) {
    return { discountKind: full.discountKind, discountValue: full.discountValue };
  }
  const priorReservations = await prisma.reservation.findMany({
    where: {
      couponCode,
      status: { not: 'CANCELLED' },
      startAt: { lt: evaluationDate },
    },
    select: { clientMemberId: true, clientEmail: true, startAt: true },
  });
  const prior = priorReservations.filter(
    (r) => isSameCouponClient(r, client) && seasonYearForAprilSeptember(r.startAt) === seasonY,
  ).length;
  if (prior >= full.seasonMaxFullUsesPerClient) {
    return { discountKind: full.discountKind, discountValue: full.seasonDegradedDiscountValue };
  }
  return { discountKind: full.discountKind, discountValue: full.discountValue };
}

/** Total TTC (centimes) : remise manuelle sur tout, coupon sur la location seulement. */
export async function computeReservationTotalDueCents(
  prisma: PrismaClient,
  input: ReservationPricingInput,
): Promise<number> {
  const rentalCents = input.rentalPriceCents ?? 0;
  const rentalDays = rentalDaysBetween(input.startAt, input.endAt);
  const extrasCents = computeExtrasTotalCents(rentalCents, input.extras, rentalDays);

  const afterManual = applyManualDiscountCents(rentalCents, extrasCents, input.discountPercent);

  const code = input.couponCode?.trim().replaceAll(/\s+/g, '').toUpperCase();
  if (!code) {
    return Math.max(0, afterManual.rentalCents + afterManual.extrasCents);
  }

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.enabled) {
    return Math.max(0, afterManual.rentalCents + afterManual.extrasCents);
  }

  const now = input.startAt.getTime();
  if (now < coupon.validFrom.getTime()) {
    return Math.max(0, afterManual.rentalCents + afterManual.extrasCents);
  }
  if (coupon.validUntil && now > coupon.validUntil.getTime()) {
    return Math.max(0, afterManual.rentalCents + afterManual.extrasCents);
  }

  const eff = await getEffectiveCouponDiscount(prisma, code, input, input.startAt, {
    discountKind: coupon.discountKind,
    discountValue: coupon.discountValue,
    seasonMaxFullUsesPerClient: coupon.seasonMaxFullUsesPerClient,
    seasonDegradedDiscountValue: coupon.seasonDegradedDiscountValue,
  });

  return applyCouponToRentalAndExtrasCents(afterManual.rentalCents, afterManual.extrasCents, {
    discountKind: eff.discountKind,
    discountValue: eff.discountValue,
  }).totalCents;
}
