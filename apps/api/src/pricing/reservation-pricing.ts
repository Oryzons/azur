import { CouponDiscountKind, type PrismaClient } from '@prisma/client';
import {
  computeReservationPricingCents,
  resolveEffectiveCouponFromReservations,
  type CouponCountableReservation,
  type ExtraLineWithChannel,
} from '@bleu-calanque/shared';

export type ReservationPricingInput = {
  rentalPriceCents: number | null;
  discountPercent: number | null;
  couponCode: string | null;
  clientMemberId: string | null;
  clientEmail: string | null;
  startAt: Date;
  endAt: Date;
  extras: ExtraLineWithChannel[];
  reservationId?: string | null;
  reservationCreatedAt?: Date | null;
};

type ReservationPricingRow = {
  id: string;
  createdAt: Date;
  rentalPriceCents: number | null;
  discountPercent: number | null;
  couponCode: string | null;
  clientMemberId: string | null;
  clientEmail: string | null;
  startAt: Date;
  endAt: Date;
};

export function reservationPricingInputFromRow(
  row: ReservationPricingRow,
  extras: ExtraLineWithChannel[],
): ReservationPricingInput {
  return {
    rentalPriceCents: row.rentalPriceCents,
    discountPercent: row.discountPercent,
    couponCode: row.couponCode,
    clientMemberId: row.clientMemberId,
    clientEmail: row.clientEmail,
    startAt: row.startAt,
    endAt: row.endAt,
    extras,
    reservationId: row.id,
    reservationCreatedAt: row.createdAt,
  };
}

const reservationCouponSelect = {
  id: true,
  createdAt: true,
  couponCode: true,
  clientMemberId: true,
  clientEmail: true,
  startAt: true,
  endAt: true,
  status: true,
  cancelledAt: true,
  paymentCapturedAt: true,
} as const;

async function loadCouponReservations(
  prisma: PrismaClient,
  couponCode: string,
): Promise<CouponCountableReservation[]> {
  return prisma.reservation.findMany({
    where: { couponCode },
    select: reservationCouponSelect,
  });
}

async function resolveCouponForReservation(
  prisma: PrismaClient,
  input: ReservationPricingInput,
): Promise<{
  discountKind: CouponDiscountKind;
  discountValue: number;
  tier: 'full' | 'degraded';
} | null> {
  const code = input.couponCode?.trim().replaceAll(/\s+/g, '').toUpperCase();
  if (!code) return null;

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.enabled) return null;

  const now = input.startAt.getTime();
  if (now < coupon.validFrom.getTime()) return null;
  if (coupon.validUntil && now > coupon.validUntil.getTime()) return null;

  const reservations = await loadCouponReservations(prisma, code);
  const eff = resolveEffectiveCouponFromReservations(
    {
      discountKind: coupon.discountKind,
      discountValue: coupon.discountValue,
      seasonMaxFullUsesPerClient: coupon.seasonMaxFullUsesPerClient,
      seasonDegradedDiscountValue: coupon.seasonDegradedDiscountValue,
    },
    input,
    input.startAt,
    code,
    reservations,
    input.reservationId
      ? { reservationId: input.reservationId, evaluationCreatedAt: input.reservationCreatedAt }
      : undefined,
  );

  return { discountKind: eff.discountKind as CouponDiscountKind, discountValue: eff.discountValue, tier: eff.tier };
}

/** Total TTC en ligne (centimes) : hors extras réglés sur place. */
export async function computeReservationTotalDueCents(
  prisma: PrismaClient,
  input: ReservationPricingInput,
): Promise<number> {
  const coupon = await resolveCouponForReservation(prisma, input);
  const pricing = computeReservationPricingCents({
    rentalPriceCents: input.rentalPriceCents ?? 0,
    discountPercent: input.discountPercent,
    extras: input.extras,
    startAt: input.startAt,
    endAt: input.endAt,
    coupon: coupon
      ? { discountKind: coupon.discountKind, discountValue: coupon.discountValue }
      : null,
  });
  return pricing.payableOnlineCents;
}

/** Total document (centimes) incluant extras hors ligne. */
export async function computeReservationGrandTotalCents(
  prisma: PrismaClient,
  input: ReservationPricingInput,
): Promise<{
  pricing: ReturnType<typeof computeReservationPricingCents>;
  coupon: { discountKind: CouponDiscountKind; discountValue: number; tier: 'full' | 'degraded' } | null;
}> {
  const resolved = await resolveCouponForReservation(prisma, input);
  const pricing = computeReservationPricingCents({
    rentalPriceCents: input.rentalPriceCents ?? 0,
    discountPercent: input.discountPercent,
    extras: input.extras,
    startAt: input.startAt,
    endAt: input.endAt,
    coupon: resolved
      ? { discountKind: resolved.discountKind, discountValue: resolved.discountValue }
      : null,
  });

  return { pricing, coupon: resolved };
}
