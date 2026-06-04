import { BadRequestException, Logger } from '@nestjs/common';
import { PaymentChannel, type Prisma, type PrismaClient } from '@prisma/client';
import { computeReservationTotalDueCents } from '../pricing/reservation-pricing';
import { mapReservationExtrasForPricing } from '../pricing/reservation-pricing-map';

const logger = new Logger('StripeCheckoutValidation');

const reservationForPricingInclude = {
  extras: { include: { extra: true } },
} satisfies Prisma.ReservationInclude;

export type ReservationForPricing = Prisma.ReservationGetPayload<{
  include: typeof reservationForPricingInclude;
}>;

/** Montant TTC attendu recalculé côté serveur (jamais depuis le frontend). */
export async function computeExpectedTotalDueCents(
  prisma: PrismaClient,
  reservation: ReservationForPricing,
): Promise<number> {
  const onlineExtras = reservation.extras.filter((l) => l.extra.paymentChannel === PaymentChannel.ONLINE);
  return computeReservationTotalDueCents(prisma, {
    rentalPriceCents: reservation.rentalPriceCents,
    discountPercent: reservation.discountPercent,
    couponCode: reservation.couponCode,
    clientMemberId: reservation.clientMemberId,
    clientEmail: reservation.clientEmail,
    startAt: reservation.startAt,
    endAt: reservation.endAt,
    extras: mapReservationExtrasForPricing(onlineExtras),
  });
}

export type ValidatedStripeCheckout = {
  reservationId: string;
  paidAmountCents: number;
  expectedAmountCents: number;
};

/**
 * Vérifie qu’une session Checkout Stripe payée correspond à la réservation
 * et que le montant encaissé égale le total recalculé serveur.
 */
export async function validateSupplementCheckoutSession(
  prisma: PrismaClient,
  input: {
    sessionId: string;
    reservationId: string;
    paidAmountCents: number | null;
    paymentStatus: string;
    currency: string | null;
    /** Montant attendu (centimes), enregistré côté serveur à la création de la session. */
    expectedSupplementCents: number;
  },
): Promise<ValidatedStripeCheckout> {
  if (input.paymentStatus !== 'paid') {
    throw new BadRequestException('Session Stripe non payée.');
  }
  if (input.currency && input.currency.toLowerCase() !== 'eur') {
    throw new BadRequestException('Devise Stripe inattendue.');
  }
  const paid = input.paidAmountCents;
  if (paid == null || !Number.isFinite(paid) || paid < 50) {
    throw new BadRequestException('Montant Stripe invalide ou manquant.');
  }
  const expected = input.expectedSupplementCents;
  if (!Number.isFinite(expected) || expected < 50) {
    throw new BadRequestException('Montant supplément attendu invalide.');
  }
  const reservation = await prisma.reservation.findUnique({ where: { id: input.reservationId } });
  if (!reservation) {
    throw new BadRequestException('Réservation introuvable pour cette session Stripe.');
  }
  if (
    reservation.stripeCheckoutSessionId &&
    reservation.stripeCheckoutSessionId !== input.sessionId
  ) {
    throw new BadRequestException('Session de paiement obsolète pour cette réservation.');
  }
  if (paid !== expected) {
    logger.error(
      `Écart supplément Stripe ${input.reservationId}: payé=${paid}, attendu=${expected} (session ${input.sessionId})`,
    );
    throw new BadRequestException(
      `Montant du supplément payé (${(paid / 100).toFixed(2)} €) différent du montant attendu (${(expected / 100).toFixed(2)} €).`,
    );
  }
  return {
    reservationId: input.reservationId,
    paidAmountCents: paid,
    expectedAmountCents: expected,
  };
}

export async function validatePaidCheckoutSession(
  prisma: PrismaClient,
  input: {
    sessionId: string;
    reservationId: string;
    paidAmountCents: number | null;
    paymentStatus: string;
    currency: string | null;
  },
): Promise<ValidatedStripeCheckout> {
  if (input.paymentStatus !== 'paid') {
    throw new BadRequestException('Session Stripe non payée.');
  }

  if (input.currency && input.currency.toLowerCase() !== 'eur') {
    throw new BadRequestException('Devise Stripe inattendue pour cette réservation.');
  }

  const paid = input.paidAmountCents;
  if (paid == null || !Number.isFinite(paid) || paid < 50) {
    throw new BadRequestException('Montant Stripe invalide ou manquant.');
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: input.reservationId },
    include: reservationForPricingInclude,
  });
  if (!reservation) {
    throw new BadRequestException('Réservation introuvable pour cette session Stripe.');
  }

  if (
    reservation.stripeCheckoutSessionId &&
    reservation.stripeCheckoutSessionId !== input.sessionId
  ) {
    throw new BadRequestException(
      'Cette session de paiement ne correspond plus à la réservation (session obsolète).',
    );
  }

  const grossCents = await computeExpectedTotalDueCents(prisma, reservation);
  const expected =
    reservation.totalDueCents != null && reservation.totalDueCents >= 0
      ? reservation.totalDueCents
      : grossCents;
  if (expected < 50) {
    throw new BadRequestException('Montant attendu invalide pour cette réservation.');
  }

  if (paid !== expected) {
    logger.error(
      `Écart montant Stripe réservation ${input.reservationId}: payé=${paid} centimes, attendu=${expected} (session ${input.sessionId})`,
    );
    throw new BadRequestException(
      `Montant payé (${(paid / 100).toFixed(2)} €) différent du montant attendu (${(expected / 100).toFixed(2)} €). Paiement non enregistré.`,
    );
  }

  return {
    reservationId: input.reservationId,
    paidAmountCents: paid,
    expectedAmountCents: expected,
  };
}
