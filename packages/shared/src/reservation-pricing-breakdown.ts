import { seasonYearForAprilSeptember } from './coupon-season';
import {
  countPriorSeasonCountableCouponUses,
  type CouponCountableReservation,
  type CouponTierEvaluationContext,
} from './coupon-usage';
import {
  applyCouponToRentalAndExtrasCents,
  applyManualDiscountCents,
  type CouponDiscountInput,
  type CouponDiscountKindInput,
} from './reservation-coupon-pricing';
import {
  computeExtrasTotalCents,
  rentalDaysBetween,
  type ExtraLineForPricing,
} from './reservation-extras-pricing';

export type ExtraLineWithChannel = ExtraLineForPricing & {
  paymentChannel?: string | null;
};

export type CouponSeasonRuleInput = {
  maxFullDiscountUsesPerClient: number;
  degradedDiscountValue: number;
};

export type EffectiveCouponDiscount = CouponDiscountInput & {
  tier: 'full' | 'degraded';
};

export function isExtraPaymentOffline(paymentChannel: string | null | undefined): boolean {
  return String(paymentChannel ?? 'ONLINE').toUpperCase() === 'OFFLINE';
}

export function splitExtrasByPaymentChannelCents(
  rentalCents: number,
  extras: readonly ExtraLineWithChannel[],
  rentalDays: number,
): { onlineCents: number; offlineCents: number } {
  const online: ExtraLineWithChannel[] = [];
  const offline: ExtraLineWithChannel[] = [];
  for (const line of extras) {
    if (isExtraPaymentOffline(line.paymentChannel)) offline.push(line);
    else online.push(line);
  }
  return {
    onlineCents: computeExtrasTotalCents(rentalCents, online, rentalDays),
    offlineCents: computeExtrasTotalCents(rentalCents, offline, rentalDays),
  };
}

export function resolveEffectiveCouponDiscount(
  full: {
    discountKind: CouponDiscountKindInput | string;
    discountValue: number;
    seasonMaxFullUsesPerClient?: number | null;
    seasonDegradedDiscountValue?: number | null;
  },
  evaluationDate: Date,
  priorSeasonUsesBefore: number,
): EffectiveCouponDiscount {
  const base: EffectiveCouponDiscount = {
    discountKind: full.discountKind as CouponDiscountKindInput,
    discountValue: full.discountValue,
    tier: 'full',
  };
  if (full.seasonMaxFullUsesPerClient == null || full.seasonDegradedDiscountValue == null) {
    return base;
  }
  if (seasonYearForAprilSeptember(evaluationDate) === null) {
    return base;
  }
  if (priorSeasonUsesBefore >= full.seasonMaxFullUsesPerClient) {
    return {
      discountKind: full.discountKind as CouponDiscountKindInput,
      discountValue: full.seasonDegradedDiscountValue,
      tier: 'degraded',
    };
  }
  return base;
}

export function resolveEffectiveCouponFromReservations(
  coupon: {
    discountKind: string;
    discountValue: number;
    seasonMaxFullUsesPerClient?: number | null;
    seasonDegradedDiscountValue?: number | null;
  },
  client: { clientMemberId?: string | null; clientEmail?: string | null },
  evaluationDate: Date,
  couponCode: string,
  reservations: readonly CouponCountableReservation[],
  context?: CouponTierEvaluationContext,
): EffectiveCouponDiscount {
  const prior = countPriorSeasonCountableCouponUses(
    reservations,
    couponCode,
    client,
    evaluationDate,
    context,
  );
  return resolveEffectiveCouponDiscount(coupon, evaluationDate, prior);
}

export type ReservationPricingCents = {
  rentalCents: number;
  onlineExtrasCents: number;
  offlineExtrasCents: number;
  rentalAfterManualCents: number;
  onlineExtrasAfterManualCents: number;
  couponDiscountOnRentalCents: number;
  /** Montant encaissé en ligne (hors extras hors ligne). */
  payableOnlineCents: number;
  /** Total document (location + extras en ligne remisés + extras hors ligne). */
  grandTotalCents: number;
};

/**
 * Tarification réservation alignée admin / API / contrats :
 * - remise manuelle sur location + extras en ligne ;
 * - coupon sur la location uniquement ;
 * - extras hors ligne ajoutés au total document, pas au payable en ligne.
 */
export function computeReservationPricingCents(input: {
  rentalPriceCents: number;
  discountPercent: number | null;
  extras: readonly ExtraLineWithChannel[];
  startAt: Date;
  endAt: Date;
  coupon: CouponDiscountInput | null;
}): ReservationPricingCents {
  const rentalCents = Math.max(0, input.rentalPriceCents ?? 0);
  const rentalDays = rentalDaysBetween(input.startAt, input.endAt);
  const { onlineCents, offlineCents } = splitExtrasByPaymentChannelCents(
    rentalCents,
    input.extras,
    rentalDays,
  );

  const afterManual = applyManualDiscountCents(rentalCents, onlineCents, input.discountPercent);
  const rentalAfterManual = afterManual.rentalCents;
  const onlineAfterManual = afterManual.extrasCents;

  let couponDiscountOnRentalCents = 0;
  let payableOnline = rentalAfterManual + onlineAfterManual;

  if (input.coupon) {
    const applied = applyCouponToRentalAndExtrasCents(rentalAfterManual, onlineAfterManual, input.coupon);
    couponDiscountOnRentalCents = Math.max(0, rentalAfterManual - applied.rentalCents);
    payableOnline = applied.totalCents;
  }

  return {
    rentalCents,
    onlineExtrasCents: onlineCents,
    offlineExtrasCents: offlineCents,
    rentalAfterManualCents: rentalAfterManual,
    onlineExtrasAfterManualCents: onlineAfterManual,
    couponDiscountOnRentalCents,
    payableOnlineCents: Math.max(0, payableOnline),
    grandTotalCents: Math.max(0, payableOnline + offlineCents),
  };
}
