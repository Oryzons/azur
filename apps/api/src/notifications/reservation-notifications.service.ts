import { BadRequestException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { PaymentChannel, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InternalNotificationsService } from '../internal-notifications/internal-notifications.service';
import { ResendMailService } from './resend-mail.service';
import { StripePaymentsService } from './stripe-payments.service';
import {
  buildReservationConfirmationHtml,
  buildReservationConfirmationText,
} from './templates/reservation-confirmation-email';
import {
  buildReservationCancellationHtml,
  buildReservationCancellationText,
} from './templates/reservation-cancellation-email';
import {
  buildMoveEmailHtml,
  buildMoveEmailText,
  buildRefundEmailHtml,
  buildRefundEmailText,
  buildStoreCreditEmailHtml,
  buildStoreCreditEmailText,
  type ResolutionEmailData,
} from './templates/reservation-resolution-email';
import { isReservationPaidForContract, resolveRentalLocations } from '@bleu-calanque/shared';
import { RentalContractsService } from '../rental-contracts/rental-contracts.service';
import { computeReservationTotalDueCents } from '../pricing/reservation-pricing';
import { mapReservationExtrasForPricing } from '../pricing/reservation-pricing-map';
import { computeExtraLineCents, rentalDaysBetween } from '@bleu-calanque/shared';
import {
  computeExpectedTotalDueCents,
  validatePaidCheckoutSession,
  validateSupplementCheckoutSession,
  type ValidatedStripeCheckout,
} from './stripe-checkout-validation';

const reservationInclude = {
  boat: true,
  extras: { include: { extra: true } },
} satisfies Prisma.ReservationInclude;

type ReservationFull = Prisma.ReservationGetPayload<{ include: typeof reservationInclude }>;

@Injectable()
export class ReservationNotificationsService {
  private readonly logger = new Logger(ReservationNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: ResendMailService,
    private readonly stripe: StripePaymentsService,
    private readonly internalNotifications: InternalNotificationsService,
    @Inject(forwardRef(() => RentalContractsService))
    private readonly rentalContracts: RentalContractsService,
  ) {}

  isStripeConfigured(): boolean {
    return this.stripe.isConfigured();
  }

  async refundStripeCheckoutPayment(
    checkoutSessionId: string,
    amountCents: number,
  ): Promise<{ refundId: string; amountCents: number }> {
    return this.stripe.refundCheckoutPayment({ checkoutSessionId, amountCents });
  }

  getStripeRefundableCents(checkoutSessionId: string): Promise<number | null> {
    return this.stripe.getCheckoutRefundableCents(checkoutSessionId);
  }

  async sendConfirmationEmail(reservationId: string): Promise<{ sent: boolean; paymentLinkUrl?: string }> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: reservationInclude,
    });
    if (!reservation) throw new BadRequestException('Réservation introuvable.');

    if (reservation.paymentChannel === PaymentChannel.OFFLINE) {
      throw new BadRequestException('Pas d’email de paiement pour une réservation en règlement à l’agence.');
    }

    const email = reservation.clientEmail?.trim();
    if (!email?.includes('@')) {
      throw new BadRequestException('Email client manquant ou invalide.');
    }

    const emailSettings = await this.prisma.emailSettings.findUnique({
      where: { id: 'email_settings' },
    });
    if (emailSettings && !emailSettings.confirmationsEnabled) {
      throw new BadRequestException('Les emails de confirmation sont désactivés dans les paramètres.');
    }

    const company = await this.prisma.companySettings.findUnique({
      where: { id: 'company_settings' },
    });

    const grossCents = await computeExpectedTotalDueCents(this.prisma, reservation);
    const totalDueCents =
      reservation.totalDueCents != null && reservation.totalDueCents >= 0
        ? reservation.totalDueCents
        : grossCents;

    let paymentLinkUrl: string | null = reservation.paymentLinkUrl;

    if (totalDueCents < 50) {
      if (!reservation.paymentCapturedAt) {
        await this.prisma.reservation.update({
          where: { id: reservationId },
          data: {
            totalDueCents: Math.max(0, totalDueCents),
            paymentCapturedAt: new Date(),
            status: 'RESERVED_PAID',
            paymentLinkUrl: null,
            stripeCheckoutSessionId: null,
          },
        });
      }
      paymentLinkUrl = null;
    } else if (this.stripe.isConfigured()) {
      const session = await this.stripe.createCheckoutSession({
        reservationId: reservation.id,
        clientEmail: email,
        description: `Location — ${reservation.boat.name}`,
        totalDueCents,
        depositAmountCents: this.resolveDepositCents(reservation),
      });
      paymentLinkUrl = session.url;
      await this.prisma.reservation.update({
        where: { id: reservationId },
        data: {
          stripeCheckoutSessionId: session.sessionId,
          paymentLinkUrl: session.url,
          totalDueCents,
        },
      });
    } else {
      this.logger.warn('Stripe non configuré — email sans lien de paiement.');
      await this.prisma.reservation.update({
        where: { id: reservationId },
        data: { totalDueCents },
      });
    }

    await this.rentalContracts.ensureForReservation(reservationId);

    const templateData = await this.buildTemplateData(reservation, company, paymentLinkUrl, totalDueCents);
    const subject = `Confirmation de réservation — ${reservation.boat.name}`;

    if (!this.mail.isConfigured()) {
      throw new BadRequestException('RESEND_API_KEY non configuré — impossible d’envoyer l’email.');
    }

    await this.mail.send({
      to: email,
      subject,
      html: buildReservationConfirmationHtml(templateData),
      text: buildReservationConfirmationText(templateData),
      replyTo: emailSettings?.replyToEmail ?? company?.contactEmail ?? undefined,
      fromName: emailSettings?.fromName ?? company?.brandName,
    });

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: { confirmationEmailSentAt: new Date() },
    });

    await this.trySendContractSignEmail(reservationId);

    return { sent: true, paymentLinkUrl: paymentLinkUrl ?? undefined };
  }

  async sendCancellationEmail(reservationId: string, reason?: string | null): Promise<{ sent: boolean }> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: reservationInclude,
    });
    if (!reservation) throw new BadRequestException('Réservation introuvable.');

    const email = reservation.clientEmail?.trim();
    if (!email?.includes('@')) {
      throw new BadRequestException('Email client manquant ou invalide.');
    }

    if (!this.mail.isConfigured()) {
      throw new BadRequestException('RESEND_API_KEY non configuré — impossible d’envoyer l’email.');
    }

    const company = await this.prisma.companySettings.findUnique({
      where: { id: 'company_settings' },
    });
    const emailSettings = await this.prisma.emailSettings.findUnique({
      where: { id: 'email_settings' },
    });

    const schedule = await this.rentalScheduleLabels(reservation);
    const templateData = {
      brandName: company?.brandName ?? 'Bleu Calanque',
      clientFirstName: reservation.clientFirstName ?? '',
      clientLastName: reservation.clientLastName ?? '',
      boatName: reservation.boat.name,
      startLabel: schedule.startLabel,
      endLabel: schedule.endLabel,
      reason: reason?.trim() ? reason.trim() : null,
      contactEmail: company?.contactEmail ?? '',
      contactPhone: company?.contactPhone ?? '',
    };

    await this.mail.send({
      to: email,
      subject: `Annulation de réservation — ${reservation.boat.name}`,
      html: buildReservationCancellationHtml(templateData),
      text: buildReservationCancellationText(templateData),
      replyTo: emailSettings?.replyToEmail ?? company?.contactEmail ?? undefined,
      fromName: emailSettings?.fromName ?? company?.brandName,
    });

    return { sent: true };
  }

  private async loadCompanyAndEmailSettings() {
    const [company, emailSettings] = await Promise.all([
      this.prisma.companySettings.findUnique({ where: { id: 'company_settings' } }),
      this.prisma.emailSettings.findUnique({ where: { id: 'email_settings' } }),
    ]);
    return { company, emailSettings };
  }

  private async rentalScheduleLabels(r: ReservationFull): Promise<{ startLabel: string; endLabel: string }> {
    const [company, booking] = await Promise.all([
      this.prisma.companySettings.findUnique({ where: { id: 'company_settings' } }),
      this.prisma.bookingSettings.findUnique({ where: { id: 'booking_settings' } }),
    ]);
    const { departure, arrival } = resolveRentalLocations({ company, booking });
    return {
      startLabel: `${this.formatDateTime(r.startAt)} — ${departure}`,
      endLabel: `${this.formatDateTime(r.endAt)} — ${arrival}`,
    };
  }

  private async resolutionEmailBase(
    r: ReservationFull,
  ): Promise<Omit<ResolutionEmailData, 'amountLabel' | 'paymentUrl' | 'note'>> {
    const schedule = await this.rentalScheduleLabels(r);
    return {
      brandName: 'Bleu Calanque',
      clientFirstName: r.clientFirstName ?? '',
      clientLastName: r.clientLastName ?? '',
      boatName: r.boat.name,
      startLabel: schedule.startLabel,
      endLabel: schedule.endLabel,
      contactEmail: '',
      contactPhone: '',
    };
  }

  async sendRefundEmail(reservationId: string, amountCents: number): Promise<{ sent: boolean }> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: reservationInclude,
    });
    if (!reservation) throw new BadRequestException('Réservation introuvable.');
    const email = reservation.clientEmail?.trim();
    if (!email?.includes('@')) return { sent: false };
    if (!this.mail.isConfigured()) return { sent: false };

    const { company, emailSettings } = await this.loadCompanyAndEmailSettings();
    const data: ResolutionEmailData = {
      ...(await this.resolutionEmailBase(reservation)),
      brandName: company?.brandName ?? 'Bleu Calanque',
      contactEmail: company?.contactEmail ?? '',
      contactPhone: company?.contactPhone ?? '',
      amountLabel: this.formatEuros(amountCents),
    };

    await this.mail.send({
      to: email,
      subject: `Remboursement effectué — ${reservation.boat.name}`,
      html: buildRefundEmailHtml(data),
      text: buildRefundEmailText(data),
      replyTo: emailSettings?.replyToEmail ?? company?.contactEmail ?? undefined,
      fromName: emailSettings?.fromName ?? company?.brandName,
    });
    return { sent: true };
  }

  async sendStoreCreditEmail(reservationId: string, amountCents: number): Promise<{ sent: boolean }> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: reservationInclude,
    });
    if (!reservation) throw new BadRequestException('Réservation introuvable.');
    const email = reservation.clientEmail?.trim();
    if (!email?.includes('@')) return { sent: false };
    if (!this.mail.isConfigured()) return { sent: false };

    const { company, emailSettings } = await this.loadCompanyAndEmailSettings();
    const data: ResolutionEmailData = {
      ...(await this.resolutionEmailBase(reservation)),
      brandName: company?.brandName ?? 'Bleu Calanque',
      contactEmail: company?.contactEmail ?? '',
      contactPhone: company?.contactPhone ?? '',
      amountLabel: this.formatEuros(amountCents),
    };

    await this.mail.send({
      to: email,
      subject: `Avoir enregistré — ${reservation.boat.name}`,
      html: buildStoreCreditEmailHtml(data),
      text: buildStoreCreditEmailText(data),
      replyTo: emailSettings?.replyToEmail ?? company?.contactEmail ?? undefined,
      fromName: emailSettings?.fromName ?? company?.brandName,
    });
    return { sent: true };
  }

  async sendMoveResolutionEmail(
    reservationId: string,
    supplementCents: number,
    paymentUrl: string | null,
  ): Promise<{ sent: boolean }> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: reservationInclude,
    });
    if (!reservation) throw new BadRequestException('Réservation introuvable.');
    const email = reservation.clientEmail?.trim();
    if (!email?.includes('@')) return { sent: false };
    if (!this.mail.isConfigured()) return { sent: false };

    const { company, emailSettings } = await this.loadCompanyAndEmailSettings();
    const data: ResolutionEmailData = {
      ...(await this.resolutionEmailBase(reservation)),
      brandName: company?.brandName ?? 'Bleu Calanque',
      contactEmail: company?.contactEmail ?? '',
      contactPhone: company?.contactPhone ?? '',
      amountLabel: supplementCents > 0 ? this.formatEuros(supplementCents) : '0,00 €',
      paymentUrl,
    };

    await this.mail.send({
      to: email,
      subject: `Réservation déplacée — ${reservation.boat.name}`,
      html: buildMoveEmailHtml(data),
      text: buildMoveEmailText(data),
      replyTo: emailSettings?.replyToEmail ?? company?.contactEmail ?? undefined,
      fromName: emailSettings?.fromName ?? company?.brandName,
    });
    return { sent: true };
  }

  async createSupplementCheckoutSession(
    reservationId: string,
    supplementCents: number,
  ): Promise<string | null> {
    if (supplementCents < 50 || !this.stripe.isConfigured()) return null;
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: reservationInclude,
    });
    if (!reservation) return null;
    const email = reservation.clientEmail?.trim();
    if (!email?.includes('@')) return null;

    const session = await this.stripe.createCheckoutSession({
      reservationId: reservation.id,
      clientEmail: email,
      description: `Supplément location — ${reservation.boat.name}`,
      totalDueCents: supplementCents,
      depositAmountCents: null,
      paymentKind: 'supplement',
    });

    await this.prisma.reservation.update({
      where: { id: reservationId },
      data: {
        stripeCheckoutSessionId: session.sessionId,
        paymentLinkUrl: session.url,
      },
    });

    return session.url;
  }

  /**
   * Idempotent : confirme le paiement à partir de la session Stripe (API Stripe, pas le navigateur).
   * Recalcule le montant attendu serveur et le compare à amount_total.
   */
  async confirmPaymentFromCheckoutSession(sessionId: string): Promise<boolean> {
    const summary = await this.stripe.getSessionSummary(sessionId);
    if (!summary.reservationId) return false;

    if (summary.paymentKind === 'supplement') {
      return this.confirmSupplementFromCheckoutSession(sessionId, summary);
    }

    let validated: ValidatedStripeCheckout;
    try {
      validated = await validatePaidCheckoutSession(this.prisma, {
        sessionId,
        reservationId: summary.reservationId,
        paidAmountCents: summary.amountTotalCents,
        paymentStatus: summary.paymentStatus,
        currency: summary.currency,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Confirmation paiement refusée (${sessionId}): ${msg}`);
      return false;
    }

    await this.rentalContracts.ensureForReservation(validated.reservationId);

    const existing = await this.prisma.reservation.findUnique({
      where: { id: validated.reservationId },
      include: { boat: true },
    });
    if (!existing) return false;

    const wasAlreadyPaid =
      existing.status === 'RESERVED_PAID' && existing.paymentCapturedAt != null;
    const capturedAt = existing.paymentCapturedAt ?? new Date();
    const paidAmountCents = validated.paidAmountCents;

    if (!wasAlreadyPaid) {
      await this.prisma.reservation.update({
        where: { id: validated.reservationId },
        data: {
          status: 'RESERVED_PAID',
          paymentCapturedAt: capturedAt,
          totalDueCents: validated.expectedAmountCents,
          stripeCheckoutSessionId: sessionId,
        },
      });
    } else if (existing.totalDueCents !== validated.expectedAmountCents) {
      await this.prisma.reservation.update({
        where: { id: validated.reservationId },
        data: { totalDueCents: validated.expectedAmountCents },
      });
    }

    try {
      if (!existing.stripeDepositPaymentIntentId) {
        const depositCents = this.resolveDepositCents(existing);
        if (depositCents != null) {
          const hold = await this.stripe.authorizeDepositAfterCheckout(sessionId, depositCents);
          if (hold) {
            await this.prisma.reservation.update({
              where: { id: validated.reservationId },
              data: { stripeDepositPaymentIntentId: hold.paymentIntentId },
            });
          } else {
            this.logger.warn(
              `Empreinte caution non placée pour ${validated.reservationId} (${(depositCents / 100).toFixed(2)} €)`,
            );
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      this.logger.warn(`Empreinte caution non enregistrée (${validated.reservationId}): ${msg}`);
    }

    if (!wasAlreadyPaid) {
      await this.internalNotifications.createFromOnlinePayment(validated.reservationId);
    }

    await this.trySendContractSignEmail(validated.reservationId);
    return true;
  }

  async handleCheckoutCompleted(sessionId: string): Promise<void> {
    await this.confirmPaymentFromCheckoutSession(sessionId);
  }

  /** Paiement d’un supplément (déplacement) — montant validé via métadonnées session serveur. */
  private async confirmSupplementFromCheckoutSession(
    sessionId: string,
    summary: {
      reservationId: string | null;
      amountTotalCents: number | null;
      paymentStatus: string;
      currency: string | null;
      expectedAmountCents: number | null;
    },
  ): Promise<boolean> {
    if (!summary.reservationId) return false;
    const expectedSupplement = summary.expectedAmountCents;
    if (expectedSupplement == null || expectedSupplement < 50) {
      this.logger.warn(`Supplément sans expectedAmountCents (session ${sessionId})`);
      return false;
    }

    try {
      await validateSupplementCheckoutSession(this.prisma, {
        sessionId,
        reservationId: summary.reservationId,
        paidAmountCents: summary.amountTotalCents,
        paymentStatus: summary.paymentStatus,
        currency: summary.currency,
        expectedSupplementCents: expectedSupplement,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Supplément Stripe refusé (${sessionId}): ${msg}`);
      return false;
    }

    await this.prisma.reservation.update({
      where: { id: summary.reservationId },
      data: { stripeCheckoutSessionId: sessionId },
    });
    return true;
  }

  /** Envoie l’email de signature si le contrat existe et n’est pas encore signé. */
  async trySendContractSignEmail(reservationId: string, opts?: { force?: boolean }): Promise<{ sent: boolean }> {
    const reservation = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation || !isReservationPaidForContract(reservation)) {
      return { sent: false };
    }
    const contract = await this.prisma.reservationRentalContract.findUnique({
      where: { reservationId },
    });
    if (contract?.signedAt) return { sent: false };
    try {
      const result = await this.rentalContracts.sendSignContractEmail(reservationId, opts);
      return { sent: result.sent };
    } catch (err) {
      this.logger.warn(
        `Email signature contrat non envoyé (${reservationId}): ${err instanceof Error ? err.message : err}`,
      );
      return { sent: false };
    }
  }

  /** Montant caution en centimes (réservation ou bateau par défaut). */
  private resolveDepositCents(
    r: Pick<ReservationFull, 'depositAmountCents' | 'boat'>,
  ): number | null {
    const cents = r.depositAmountCents ?? r.boat.depositAmountCents ?? 0;
    return cents >= 50 ? cents : null;
  }

  private async resolveTotalDueCents(r: ReservationFull): Promise<number> {
    if (r.paymentCapturedAt && r.totalDueCents != null && r.totalDueCents > 0) {
      return r.totalDueCents;
    }
    const onlineExtras = r.extras.filter((l) => l.extra.paymentChannel === PaymentChannel.ONLINE);
    const computed = await computeReservationTotalDueCents(this.prisma, {
      rentalPriceCents: r.rentalPriceCents,
      discountPercent: r.discountPercent,
      couponCode: r.couponCode,
      clientMemberId: r.clientMemberId,
      clientEmail: r.clientEmail,
      startAt: r.startAt,
      endAt: r.endAt,
      extras: mapReservationExtrasForPricing(onlineExtras),
    });
    if (r.totalDueCents != null && r.totalDueCents > 0 && !r.couponCode?.trim()) {
      return r.totalDueCents;
    }
    return computed > 0 ? computed : (r.totalDueCents ?? 0);
  }

  private formatEuros(cents: number): string {
    return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
  }

  private formatDateTime(d: Date): string {
    return d.toLocaleString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private async buildTemplateData(
    r: ReservationFull,
    company: { brandName: string; contactEmail: string; contactPhone: string; addressLine: string; city: string; postalCode: string } | null,
    paymentUrl: string | null,
    totalDueCents: number,
  ) {
    const schedule = await this.rentalScheduleLabels(r);
    const rentalDays = rentalDaysBetween(r.startAt, r.endAt);
    const rentalCents = r.rentalPriceCents ?? 0;
    const extrasLines = r.extras
      .filter((line) => line.extra.paymentChannel === PaymentChannel.ONLINE)
      .map((line) => {
      const cents = computeExtraLineCents(
        rentalCents,
        {
          quantity: line.quantity,
          extra: {
            priceKind: line.extra.priceKind,
            priceValue: line.extra.priceValue,
            billingUnit: line.extra.billingUnit,
          },
        },
        rentalDays,
      );
      return { name: line.extra.name, amountLabel: this.formatEuros(cents) };
    });

    return {
      brandName: company?.brandName ?? 'Bleu Calanque',
      clientFirstName: r.clientFirstName ?? '',
      clientLastName: r.clientLastName ?? '',
      boatName: r.boat.name,
      startLabel: schedule.startLabel,
      endLabel: schedule.endLabel,
      rentalAmountLabel: this.formatEuros(r.rentalPriceCents ?? 0),
      extrasLines,
      totalAmountLabel: this.formatEuros(totalDueCents),
      depositAmountLabel: (() => {
        const cents = this.resolveDepositCents(r);
        return cents != null ? this.formatEuros(cents) : null;
      })(),
      paymentUrl,
      contactEmail: company?.contactEmail ?? '',
      contactPhone: company?.contactPhone ?? '',
      addressLine: company
        ? `${company.addressLine}, ${company.postalCode} ${company.city}`
        : '',
    };
  }
}
