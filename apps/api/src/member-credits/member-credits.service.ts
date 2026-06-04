import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MemberCreditsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeEmail(email: string | null | undefined): string | null {
    const em = email?.trim().toLowerCase() || null;
    return em?.includes('@') ? em : null;
  }

  clientKey(memberId: string | null | undefined, email: string | null | undefined): {
    memberId: string | null;
    clientEmail: string | null;
  } {
    const mid = memberId?.trim() || null;
    return { memberId: mid, clientEmail: this.normalizeEmail(email) };
  }

  /** Somme des avoirs déjà imputés sur cette réservation. */
  async appliedCentsForReservation(reservationId: string): Promise<number> {
    const rows = await this.prisma.memberCreditUsage.findMany({
      where: { reservationId },
      select: { amountCents: true },
    });
    return rows.reduce((sum, r) => sum + r.amountCents, 0);
  }

  async availableCreditsCents(memberId: string | null, clientEmail: string | null): Promise<number> {
    const now = new Date();
    const em = this.normalizeEmail(clientEmail);
    const rows = await this.prisma.memberCredit.findMany({
      where: {
        remainingAmountCents: { gt: 0 },
        OR: [
          ...(memberId ? [{ memberId }] : []),
          ...(em ? [{ clientEmail: em }] : []),
        ],
      },
    });
    return rows
      .filter((r) => !r.expiresAt || r.expiresAt.getTime() > now.getTime())
      .reduce((sum, r) => sum + r.remainingAmountCents, 0);
  }

  async listAvailable(memberId: string | null, clientEmail: string | null) {
    const now = new Date();
    const em = this.normalizeEmail(clientEmail);
    const rows = await this.prisma.memberCredit.findMany({
      where: {
        remainingAmountCents: { gt: 0 },
        OR: [
          ...(memberId ? [{ memberId }] : []),
          ...(em ? [{ clientEmail: em }] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.filter((r) => !r.expiresAt || r.expiresAt.getTime() > now.getTime());
  }

  async issueCredit(input: {
    memberId: string | null;
    clientEmail: string | null;
    sourceReservationId: string;
    amountCents: number;
    note?: string | null;
  }) {
    if (input.amountCents < 1) return null;
    return this.prisma.memberCredit.create({
      data: {
        memberId: input.memberId,
        clientEmail: input.clientEmail,
        sourceReservationId: input.sourceReservationId,
        initialAmountCents: input.amountCents,
        remainingAmountCents: input.amountCents,
        note: input.note?.trim() || null,
      },
    });
  }

  /**
   * Montant déjà réglé pour cette réservation (avoirs consommés + éventuel paiement Stripe).
   * Utile après un déplacement : une réservation à 0 € après avoir compte quand même comme payée.
   */
  async collectedCentsOnReservation(reservationId: string): Promise<number> {
    const agg = await this.prisma.memberCreditUsage.aggregate({
      where: { reservationId },
      _sum: { amountCents: true },
    });
    const credits = agg._sum.amountCents ?? 0;
    const r = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { totalDueCents: true, paymentCapturedAt: true },
    });
    if (!r?.paymentCapturedAt) return 0;
    const stripePortion = (r.totalDueCents ?? 0) >= 50 ? (r.totalDueCents ?? 0) : 0;
    return credits + stripePortion;
  }

  /** Consomme les avoirs disponibles (FIFO) jusqu'à `maxCents`. */
  async applyCreditsToReservation(input: {
    reservationId: string;
    memberId: string | null;
    clientEmail: string | null;
    maxCents: number;
  }): Promise<number> {
    if (input.maxCents < 1) return 0;
    const credits = await this.listAvailable(
      input.memberId?.trim() || null,
      this.normalizeEmail(input.clientEmail),
    );
    let remaining = input.maxCents;
    let applied = 0;

    for (const credit of credits) {
      if (remaining <= 0) break;
      const take = Math.min(credit.remainingAmountCents, remaining);
      if (take <= 0) continue;

      await this.prisma.$transaction([
        this.prisma.memberCredit.update({
          where: { id: credit.id },
          data: { remainingAmountCents: credit.remainingAmountCents - take },
        }),
        this.prisma.memberCreditUsage.create({
          data: {
            creditId: credit.id,
            reservationId: input.reservationId,
            amountCents: take,
          },
        }),
      ]);

      applied += take;
      remaining -= take;
    }

    return applied;
  }
}
