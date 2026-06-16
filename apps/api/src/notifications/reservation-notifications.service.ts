import { BadRequestException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import {
  CouponDiscountKind,
  PaymentChannel,
  PaymentMethod as PrismaPaymentMethod,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InternalNotificationsService } from '../internal-notifications/internal-notifications.service';
import { ResendMailService } from './resend-mail.service';
import { StripePaymentsService, type StripeRefundTarget } from './stripe-payments.service';
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
import {
  DEFAULT_BRAND_NAME,
  isReservationPaidForContract,
  resolveRentalLocations,
  formatPaymentMethodForDocument,
  installmentLabel,
  resolveStoreCreditAppliedCents,
  type PaymentMethod,
} from '@bleu-calanque/shared';
import { RentalContractsService } from '../rental-contracts/rental-contracts.service';
import {
  computeReservationGrandTotalCents,
  computeReservationTotalDueCents,
  reservationPricingInputFromRow,
} from '../pricing/reservation-pricing';
import { MemberCreditsService } from '../member-credits/member-credits.service';
import { mapReservationExtrasForPricing } from '../pricing/reservation-pricing-map';
import { computeExtraLineCents, extraDocumentLabel, rentalDaysBetween } from '@bleu-calanque/shared';
import {
  computeExpectedTotalDueCents,
  validatePaidCheckoutSession,
  validateSupplementCheckoutSession,
  type ValidatedStripeCheckout,
} from './stripe-checkout-validation';

const reservationInclude = {
  boat: true,
  extras: { include: { extra: true } },
  installmentPlan: { orderBy: { sequence: 'asc' } },
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
    private readonly memberCredits: MemberCreditsService,
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

  async refundStripePaymentTarget(
    target: StripeRefundTarget,
    amountCents: number,
  ): Promise<{ refundId: string; amountCents: number }> {
    return this.stripe.refundPaymentTarget(target, amountCents);
  }

  getStripeRefundableCents(checkoutSessionId: string): Promise<number | null> {
    return this.stripe.getCheckoutRefundableCents(checkoutSessionId);
  }

  getStripeTotalRefundedCents(reservationId: string): Promise<number> {
    return this.stripe.getTotalRefundedCentsForReservation(reservationId);
  }

  /**
   * Sessions Checkout Stripe encore remboursables pour une réservation.
   * En paiement 2×, le champ reservation.stripeCheckoutSessionId pointe souvent vers le lien du solde (non payé) :
   * on s'appuie d'abord sur les échéances en ligne déjà réglées.
   */
  async getStripeRefundTargetsForReservation(reservation: {
    id: string;
    stripeCheckoutSessionId: string | null;
    installmentPlan: {
      status: string;
      method: PaymentMethod;
      stripeCheckoutSessionId: string | null;
      sequence: number;
    }[];
  }): Promise<StripeRefundTarget[]> {
    if (!this.stripe.isConfigured()) return [];

    const targets: StripeRefundTarget[] = [];
    const seenSessions = new Set<string>();
    const seenPaymentIntents = new Set<string>();

    const sessionCandidates: { sessionId: string; sequence: number | null }[] = [];
    for (const inst of reservation.installmentPlan) {
      if (inst.status !== 'PAID' || inst.method !== PrismaPaymentMethod.ONLINE) continue;
      const sessionId = inst.stripeCheckoutSessionId?.trim();
      if (sessionId) sessionCandidates.push({ sessionId, sequence: inst.sequence });
    }
    const rootSessionId = reservation.stripeCheckoutSessionId?.trim();
    if (rootSessionId) sessionCandidates.push({ sessionId: rootSessionId, sequence: null });

    for (const { sessionId, sequence } of sessionCandidates) {
      if (seenSessions.has(sessionId)) continue;
      seenSessions.add(sessionId);
      const refundableCents = await this.getStripeRefundableCents(sessionId);
      if (refundableCents == null || refundableCents <= 0) continue;
      targets.push({ checkoutSessionId: sessionId, refundableCents, sequence });
    }

    const discovered = await this.stripe.findRefundablePaymentTargetsForReservation(reservation.id);
    for (const target of discovered) {
      if (target.paymentIntentId && seenPaymentIntents.has(target.paymentIntentId)) continue;
      if (target.paymentIntentId) seenPaymentIntents.add(target.paymentIntentId);
      if (
        target.checkoutSessionId &&
        seenSessions.has(target.checkoutSessionId) &&
        !target.paymentIntentId
      ) {
        continue;
      }
      targets.push(target);
    }

    const merged = new Map<string, StripeRefundTarget>();
    for (const target of targets) {
      const key = target.paymentIntentId ?? `session:${target.checkoutSessionId}`;
      const prev = merged.get(key);
      if (!prev || target.refundableCents > prev.refundableCents) merged.set(key, target);
    }

    return [...merged.values()].sort((a, b) => b.refundableCents - a.refundableCents);
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

    const charge = this.resolveOnlineChargeNow(reservation, totalDueCents);

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
    } else if (charge.amountCents < 50) {
      // Paiement en 2 fois dont l'échéance due maintenant est réglée sur place : pas de lien Stripe.
      paymentLinkUrl = null;
      await this.prisma.reservation.update({
        where: { id: reservationId },
        data: { totalDueCents, paymentLinkUrl: null },
      });
    } else if (this.stripe.isConfigured()) {
      const session = await this.stripe.createCheckoutSession({
        reservationId: reservation.id,
        clientEmail: email,
        description: `Location — ${reservation.boat.name}`,
        totalDueCents: charge.amountCents,
        depositAmountCents: this.resolveDepositCents(reservation),
        installmentSequence: charge.sequence,
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
      if (charge.sequence != null) {
        await this.prisma.reservationInstallment.updateMany({
          where: { reservationId, sequence: charge.sequence },
          data: { stripeCheckoutSessionId: session.sessionId, paymentLinkUrl: session.url },
        });
      }
    } else {
      this.logger.warn('Stripe non configuré — email sans lien de paiement.');
      await this.prisma.reservation.update({
        where: { id: reservationId },
        data: { totalDueCents },
      });
    }

    await this.rentalContracts.ensureForReservation(reservationId);

    const templateData = await this.buildTemplateData(
      reservation,
      company,
      paymentLinkUrl,
      totalDueCents,
      charge,
    );
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
      brandName: company?.brandName ?? DEFAULT_BRAND_NAME,
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
      brandName: DEFAULT_BRAND_NAME,
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
      brandName: company?.brandName ?? DEFAULT_BRAND_NAME,
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
      brandName: company?.brandName ?? DEFAULT_BRAND_NAME,
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
      brandName: company?.brandName ?? DEFAULT_BRAND_NAME,
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

    if (summary.installmentSequence != null) {
      return this.confirmInstallmentFromCheckoutSession(sessionId, summary);
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
      await this.persistStripeFeesForSession(sessionId, { reservationId: validated.reservationId });
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

  /** Confirme une échéance (paiement en 2 fois) à partir d'une session Stripe. */
  private async confirmInstallmentFromCheckoutSession(
    sessionId: string,
    summary: {
      reservationId: string | null;
      amountTotalCents: number | null;
      paymentStatus: string;
      currency: string | null;
      installmentSequence: number | null;
    },
  ): Promise<boolean> {
    if (!summary.reservationId || summary.installmentSequence == null) return false;
    if (summary.paymentStatus !== 'paid') return false;
    if (summary.currency && summary.currency.toLowerCase() !== 'eur') return false;

    const installment = await this.prisma.reservationInstallment.findUnique({
      where: {
        reservationId_sequence: {
          reservationId: summary.reservationId,
          sequence: summary.installmentSequence,
        },
      },
    });
    if (!installment) {
      this.logger.warn(`Échéance ${summary.installmentSequence} introuvable (${summary.reservationId}).`);
      return false;
    }

    const paid = summary.amountTotalCents ?? 0;
    if (paid !== installment.amountCents) {
      this.logger.error(
        `Écart échéance ${summary.installmentSequence} (${summary.reservationId}): payé=${paid}, attendu=${installment.amountCents}`,
      );
      return false;
    }

    if (installment.status === 'PAID') return true;

    await this.prisma.reservationInstallment.update({
      where: { id: installment.id },
      data: { status: 'PAID', paidAt: new Date(), stripeCheckoutSessionId: sessionId },
    });
    await this.persistStripeFeesForSession(sessionId, { installmentId: installment.id });

    const existing = await this.prisma.reservation.findUnique({
      where: { id: summary.reservationId },
      include: reservationInclude,
    });
    if (!existing) return false;

    if (summary.installmentSequence === 1) {
      // Acompte réglé → réservation confirmée (réservée/payée), caution + contrat.
      await this.rentalContracts.ensureForReservation(existing.id);
      if (existing.status !== 'RESERVED_PAID' || existing.paymentCapturedAt == null) {
        await this.prisma.reservation.update({
          where: { id: existing.id },
          data: {
            status: 'RESERVED_PAID',
            paymentCapturedAt: existing.paymentCapturedAt ?? new Date(),
          },
        });
        await this.internalNotifications.createFromOnlinePayment(existing.id);
      }
      await this.placeDepositHoldIfNeeded(existing, sessionId);
      await this.trySendContractSignEmail(existing.id);

      // Solde en ligne → génère et envoie automatiquement le 2e lien de paiement.
      const solde = existing.installmentPlan.find((p) => p.sequence === 2);
      if (solde && solde.method === 'ONLINE' && solde.status !== 'PAID') {
        try {
          await this.sendConfirmationEmail(existing.id);
        } catch (err) {
          this.logger.warn(
            `2e lien de paiement non envoyé (${existing.id}): ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } else {
      // Solde réglé → s'assurer que le contrat est traité.
      await this.trySendContractSignEmail(existing.id);
    }

    return true;
  }

  /**
   * Marque manuellement une échéance comme réglée/non réglée (modes hors ligne :
   * espèces, chèque, TPE, virement). Déclenche les effets de bord côté acompte.
   */
  async setInstallmentPaid(
    reservationId: string,
    sequence: number,
    paid: boolean,
  ): Promise<{ ok: boolean }> {
    const installment = await this.prisma.reservationInstallment.findUnique({
      where: { reservationId_sequence: { reservationId, sequence } },
    });
    if (!installment) throw new BadRequestException('Échéance introuvable.');

    await this.prisma.reservationInstallment.update({
      where: { id: installment.id },
      data: { status: paid ? 'PAID' : 'PENDING', paidAt: paid ? new Date() : null },
    });

    if (!paid) return { ok: true };

    const existing = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: reservationInclude,
    });
    if (!existing) return { ok: true };

    if (sequence === 1) {
      await this.rentalContracts.ensureForReservation(reservationId);
      if (existing.status !== 'RESERVED_PAID' || existing.paymentCapturedAt == null) {
        await this.prisma.reservation.update({
          where: { id: reservationId },
          data: {
            status: 'RESERVED_PAID',
            paymentCapturedAt: existing.paymentCapturedAt ?? new Date(),
          },
        });
      }
      await this.trySendContractSignEmail(reservationId);

      const solde = existing.installmentPlan.find((p) => p.sequence === 2);
      if (solde && solde.method === 'ONLINE' && solde.status !== 'PAID' && existing.paymentChannel === 'ONLINE') {
        try {
          await this.sendConfirmationEmail(reservationId);
        } catch (err) {
          this.logger.warn(
            `2e lien de paiement non envoyé (${reservationId}): ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } else {
      await this.trySendContractSignEmail(reservationId);
    }

    return { ok: true };
  }

  /** Enregistre les frais réels depuis Stripe (balance_transaction). */
  private async persistStripeFeesForSession(
    sessionId: string,
    target: { installmentId?: string; reservationId?: string },
  ): Promise<void> {
    if (!this.stripe.isConfigured()) return;
    const fees = await this.stripe.getCheckoutStripeFees(sessionId);
    if (!fees) return;
    if (target.installmentId) {
      await this.prisma.reservationInstallment.update({
        where: { id: target.installmentId },
        data: { stripeFeeCents: fees.feeCents, stripeNetCents: fees.netCents },
      });
    } else if (target.reservationId) {
      await this.prisma.reservation.update({
        where: { id: target.reservationId },
        data: { stripeFeeCents: fees.feeCents, stripeNetCents: fees.netCents },
      });
    }
  }

  /** Rattrapage des frais Stripe manquants (paiements déjà encaissés). */
  async syncMissingStripeFees(limit = 80): Promise<{ updated: number }> {
    if (!this.stripe.isConfigured()) return { updated: 0 };
    let updated = 0;

    const installments = await this.prisma.reservationInstallment.findMany({
      where: {
        status: 'PAID',
        method: 'ONLINE',
        stripeCheckoutSessionId: { not: null },
        stripeFeeCents: null,
      },
      take: limit,
      select: { id: true, stripeCheckoutSessionId: true },
    });
    for (const row of installments) {
      if (!row.stripeCheckoutSessionId) continue;
      await this.persistStripeFeesForSession(row.stripeCheckoutSessionId, { installmentId: row.id });
      const check = await this.prisma.reservationInstallment.findUnique({
        where: { id: row.id },
        select: { stripeFeeCents: true },
      });
      if (check?.stripeFeeCents != null) updated += 1;
    }

    const remaining = Math.max(0, limit - installments.length);
    if (remaining > 0) {
      const reservations = await this.prisma.reservation.findMany({
        where: {
          paymentCapturedAt: { not: null },
          paymentChannel: 'ONLINE',
          stripeCheckoutSessionId: { not: null },
          stripeFeeCents: null,
          installmentPlan: { none: {} },
        },
        take: remaining,
        select: { id: true, stripeCheckoutSessionId: true },
      });
      for (const row of reservations) {
        if (!row.stripeCheckoutSessionId) continue;
        await this.persistStripeFeesForSession(row.stripeCheckoutSessionId, { reservationId: row.id });
        const check = await this.prisma.reservation.findUnique({
          where: { id: row.id },
          select: { stripeFeeCents: true },
        });
        if (check?.stripeFeeCents != null) updated += 1;
      }
    }

    return { updated };
  }

  private async placeDepositHoldIfNeeded(
    reservation: ReservationFull,
    sessionId: string,
  ): Promise<void> {
    if (reservation.stripeDepositPaymentIntentId) return;
    const depositCents = this.resolveDepositCents(reservation);
    if (depositCents == null) return;
    try {
      const hold = await this.stripe.authorizeDepositAfterCheckout(sessionId, depositCents);
      if (hold) {
        await this.prisma.reservation.update({
          where: { id: reservation.id },
          data: { stripeDepositPaymentIntentId: hold.paymentIntentId },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Empreinte caution non enregistrée (${reservation.id}): ${err instanceof Error ? err.message : err}`,
      );
    }
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

  /**
   * Montant à encaisser en ligne maintenant + numéro d'échéance, selon le plan.
   * Paiement unique → total. 2 fois → acompte si en ligne & non réglé, sinon
   * solde si l'acompte est réglé & le solde en ligne, sinon 0 (réglé sur place).
   */
  private resolveOnlineChargeNow(
    r: ReservationFull,
    totalDueCents: number,
  ): { amountCents: number; sequence?: number; buttonLabel: string } {
    const plan = [...(r.installmentPlan ?? [])].sort((a, b) => a.sequence - b.sequence);
    if (plan.length !== 2) {
      return { amountCents: totalDueCents, buttonLabel: 'Payer ma réservation' };
    }
    const acompte = plan.find((p) => p.sequence === 1);
    const solde = plan.find((p) => p.sequence === 2);
    if (acompte && acompte.method === 'ONLINE' && acompte.status !== 'PAID') {
      return { amountCents: acompte.amountCents, sequence: 1, buttonLabel: "Payer l'acompte" };
    }
    if (
      acompte?.status === 'PAID' &&
      solde &&
      solde.method === 'ONLINE' &&
      solde.status !== 'PAID'
    ) {
      return { amountCents: solde.amountCents, sequence: 2, buttonLabel: 'Payer le solde' };
    }
    return { amountCents: 0, buttonLabel: 'Payer ma réservation' };
  }

  private buildInstallmentLines(r: ReservationFull) {
    const plan = [...(r.installmentPlan ?? [])].sort((a, b) => a.sequence - b.sequence);
    if (plan.length < 2) return undefined;
    return plan.map((p) => ({
      label: p.label ?? installmentLabel(p.sequence, plan.length),
      amountLabel: this.formatEuros(p.amountCents),
      methodLabel: formatPaymentMethodForDocument({
        paymentChannel: r.paymentChannel,
        method: p.method as PaymentMethod,
        settlementNote: r.settlementNote,
      }),
      paid: p.status === 'PAID',
    }));
  }

  private async resolveTotalDueCents(r: ReservationFull): Promise<number> {
    if (r.paymentCapturedAt && r.totalDueCents != null && r.totalDueCents > 0) {
      return r.totalDueCents;
    }
    const onlineExtras = r.extras.filter((l) => l.extra.paymentChannel === PaymentChannel.ONLINE);
    const computed = await computeReservationTotalDueCents(
      this.prisma,
      reservationPricingInputFromRow(r, mapReservationExtrasForPricing(onlineExtras)),
    );
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
    charge?: { amountCents: number; sequence?: number; buttonLabel: string },
  ) {
    const schedule = await this.rentalScheduleLabels(r);
    const rentalDays = rentalDaysBetween(r.startAt, r.endAt);
    const rentalCents = r.rentalPriceCents ?? 0;
    const mapExtraLine = (line: (typeof r.extras)[number], offline: boolean) => {
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
      return {
        name: extraDocumentLabel(line.extra.name, offline ? PaymentChannel.OFFLINE : line.extra.paymentChannel),
        amountLabel: this.formatEuros(cents),
        cents,
      };
    };

    const onlineExtras = r.extras.filter((line) => line.extra.paymentChannel === PaymentChannel.ONLINE);
    const offlineExtras = r.extras.filter((line) => line.extra.paymentChannel === PaymentChannel.OFFLINE);
    const extrasLines = onlineExtras.map((line) => {
      const mapped = mapExtraLine(line, false);
      return { name: mapped.name, amountLabel: mapped.amountLabel };
    });
    let offlineDueCents = 0;
    const offlineExtrasLines = offlineExtras.map((line) => {
      const mapped = mapExtraLine(line, true);
      offlineDueCents += mapped.cents;
      return { name: mapped.name, amountLabel: mapped.amountLabel };
    });

    const { pricing, coupon: effectiveCoupon } = await computeReservationGrandTotalCents(
      this.prisma,
      reservationPricingInputFromRow(r, mapReservationExtrasForPricing(onlineExtras)),
    );
    const recordedCredit = await this.memberCredits.appliedCentsForReservation(r.id);
    const storeCreditCents = resolveStoreCreditAppliedCents(
      pricing.payableOnlineCents,
      totalDueCents,
      recordedCredit,
    );

    const adjustmentLines: { label: string; amountLabel: string }[] = [];
    if (r.couponCode?.trim() && pricing.couponDiscountOnRentalCents > 0) {
      const code = r.couponCode.trim();
      let couponDetail = '';
      if (effectiveCoupon) {
        const kindLabel =
          effectiveCoupon.discountKind === CouponDiscountKind.PERCENT
            ? `−${effectiveCoupon.discountValue} %`
            : `−${effectiveCoupon.discountValue.toFixed(2).replace('.', ',')} €`;
        couponDetail = ` (${kindLabel})`;
        if (effectiveCoupon.tier === 'degraded') {
          couponDetail += ' · palier réduit';
        }
      }
      adjustmentLines.push({
        label: `Coupon ${code}${couponDetail} · sur location uniquement`,
        amountLabel: `−${this.formatEuros(pricing.couponDiscountOnRentalCents).replace(' €', '')} €`,
      });
    }
    if (storeCreditCents > 0) {
      adjustmentLines.push({
        label: 'Avoir client',
        amountLabel: `−${this.formatEuros(storeCreditCents).replace(' €', '')} €`,
      });
    }

    return {
      brandName: company?.brandName ?? DEFAULT_BRAND_NAME,
      clientFirstName: r.clientFirstName ?? '',
      clientLastName: r.clientLastName ?? '',
      boatName: r.boat.name,
      startLabel: schedule.startLabel,
      endLabel: schedule.endLabel,
      rentalAmountLabel: this.formatEuros(r.rentalPriceCents ?? 0),
      extrasLines,
      offlineExtrasLines,
      offlineDueAmountLabel: offlineDueCents > 0 ? this.formatEuros(offlineDueCents) : null,
      adjustmentLines,
      totalAmountLabel: this.formatEuros(totalDueCents),
      depositAmountLabel: (() => {
        const cents = this.resolveDepositCents(r);
        return cents != null ? this.formatEuros(cents) : null;
      })(),
      paymentUrl,
      installmentLines: this.buildInstallmentLines(r),
      payButtonLabel: charge?.buttonLabel ?? null,
      payNowAmountLabel:
        charge && charge.amountCents >= 50 ? this.formatEuros(charge.amountCents) : null,
      contactEmail: company?.contactEmail ?? '',
      contactPhone: company?.contactPhone ?? '',
      addressLine: company
        ? `${company.addressLine}, ${company.postalCode} ${company.city}`
        : '',
    };
  }
}
