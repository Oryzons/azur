import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { stripeErrorMessageFr } from '../common/stripe/stripe-error-message';
import type { Env } from '../config/env';

type StripeClient = InstanceType<typeof Stripe>;

@Injectable()
export class StripePaymentsService {
  private readonly logger = new Logger(StripePaymentsService.name);
  private readonly stripe: StripeClient | null;

  constructor(private readonly config: ConfigService<Env, true>) {
    const key = this.config.get('STRIPE_SECRET_KEY', { infer: true });
    this.stripe = key ? new Stripe(key) : null;
  }

  isConfigured(): boolean {
    return Boolean(this.stripe);
  }

  private client(): StripeClient {
    if (!this.stripe) throw new BadRequestException('Stripe n’est pas configuré (STRIPE_SECRET_KEY).');
    return this.stripe;
  }

  private publicAppUrl(): string {
    return (
      this.config.get('PUBLIC_APP_URL', { infer: true }) ??
      this.config.get('ADMIN_URL', { infer: true }) ??
      'http://localhost:5173'
    );
  }

  async createCheckoutSession(input: {
    reservationId: string;
    clientEmail: string;
    description: string;
    totalDueCents: number;
    depositAmountCents: number | null;
    /** full = solde location ; supplement = complément après déplacement. */
    paymentKind?: 'full' | 'supplement';
  }): Promise<{ sessionId: string; url: string }> {
    const stripe = this.client();
    if (input.totalDueCents < 50) {
      throw new BadRequestException('Montant de paiement invalide.');
    }

    const base = this.publicAppUrl().replace(/\/$/, '');
    const paymentKind = input.paymentKind ?? 'full';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_creation: 'always',
      customer_email: input.clientEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: input.totalDueCents,
            product_data: {
              name: input.description,
              description:
                paymentKind === 'supplement'
                  ? 'Location bateau — supplément'
                  : 'Location bateau — paiement du solde',
            },
          },
        },
      ],
      payment_intent_data: {
        setup_future_usage: paymentKind === 'full' ? 'off_session' : undefined,
        metadata: {
          reservationId: input.reservationId,
          paymentKind,
          expectedAmountCents: String(input.totalDueCents),
          depositAmountCents: String(input.depositAmountCents ?? 0),
        },
      },
      metadata: {
        reservationId: input.reservationId,
        paymentKind,
        expectedAmountCents: String(input.totalDueCents),
        depositAmountCents: String(input.depositAmountCents ?? 0),
      },
      success_url: `${base}/paiement/succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/paiement/annule?reservation_id=${input.reservationId}`,
    });

    if (!session.url) throw new BadRequestException('Impossible de créer la session Stripe.');
    return { sessionId: session.id, url: session.url };
  }

  /**
   * Empreinte bancaire (autorisation sans débit) après le paiement location.
   * Le checkout ne débite que totalDueCents ; la caution est bloquée ici via capture_method: manual.
   */
  async authorizeDepositAfterCheckout(
    sessionId: string,
    depositCents: number,
  ): Promise<{ paymentIntentId: string; status: string } | null> {
    if (!Number.isFinite(depositCents) || depositCents < 50) {
      this.logger.warn(`Montant caution invalide (${depositCents}) — empreinte ignorée.`);
      return null;
    }

    const stripe = this.client();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'customer'],
    });
    if (session.payment_status !== 'paid') return null;

    const reservationId = session.metadata?.reservationId;
    if (!reservationId) return null;

    const pi = session.payment_intent;
    const paymentIntent = typeof pi === 'string' ? await stripe.paymentIntents.retrieve(pi) : pi;
    if (!paymentIntent?.payment_method) {
      this.logger.warn(`Pas de moyen de paiement sur la session ${sessionId}`);
      return null;
    }

    const pmId =
      typeof paymentIntent.payment_method === 'string'
        ? paymentIntent.payment_method
        : paymentIntent.payment_method.id;

    let customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;

    if (!customerId && session.customer_email) {
      const customer = await stripe.customers.create({ email: session.customer_email });
      customerId = customer.id;
    }

    if (!customerId) {
      this.logger.warn(`Client Stripe introuvable pour empreinte caution (${reservationId})`);
      return null;
    }

    try {
      await stripe.paymentMethods.attach(pmId, { customer: customerId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (!/already been attached|already attached to/i.test(msg)) {
        throw err;
      }
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pmId },
    });

    const auth = await stripe.paymentIntents.create({
      amount: depositCents,
      currency: 'eur',
      customer: customerId,
      payment_method: pmId,
      capture_method: 'manual',
      confirm: true,
      off_session: true,
      description: `Caution (empreinte) — réservation ${reservationId}`,
      metadata: { reservationId, kind: 'deposit_hold' },
      payment_method_options: {
        card: {
          request_extended_authorization: 'if_available',
        },
      },
    });

    if (auth.status !== 'requires_capture' && auth.status !== 'succeeded') {
      this.logger.warn(
        `Empreinte caution ${auth.id} statut inattendu: ${auth.status} (réservation ${reservationId})`,
      );
      if (auth.status === 'requires_action') {
        return null;
      }
    }

    this.logger.log(`Empreinte caution ${auth.id} (${auth.status}) pour réservation ${reservationId}`);
    return { paymentIntentId: auth.id, status: auth.status };
  }

  /**
   * Vérifie la signature Stripe — seule source de vérité pour les événements webhook.
   * @throws BadRequestException si secret manquant ou signature invalide
   */
  constructWebhookEvent(payload: Buffer, signature: string) {
    const secret = this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    if (!secret?.trim()) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET manquant.');
    }
    if (!signature?.trim()) {
      throw new BadRequestException('En-tête stripe-signature manquant.');
    }
    if (!payload?.length) {
      throw new BadRequestException('Corps webhook vide.');
    }
    try {
      return this.client().webhooks.constructEvent(payload, signature, secret);
    } catch (err) {
      if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
        throw new BadRequestException('Signature webhook Stripe invalide.');
      }
      throw err;
    }
  }

  async getSessionSummary(sessionId: string) {
    const stripe = this.client();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
    const paymentKindRaw = session.metadata?.paymentKind;
    const paymentKind =
      paymentKindRaw === 'supplement' ? ('supplement' as const) : ('full' as const);
    const expectedFromMeta = session.metadata?.expectedAmountCents;
    const expectedAmountCents =
      expectedFromMeta != null && expectedFromMeta !== ''
        ? Number.parseInt(expectedFromMeta, 10)
        : null;

    return {
      id: session.id,
      paymentStatus: session.payment_status,
      reservationId: session.metadata?.reservationId ?? null,
      amountTotalCents: session.amount_total ?? null,
      currency: session.currency ?? null,
      paymentKind,
      expectedAmountCents:
        expectedAmountCents != null && Number.isFinite(expectedAmountCents)
          ? expectedAmountCents
          : null,
    };
  }

  /** Montant encore remboursable sur le PaymentIntent de la session (centimes). */
  async getCheckoutRefundableCents(checkoutSessionId: string): Promise<number | null> {
    const stripe = this.client();
    try {
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
        expand: ['payment_intent'],
      });
      if (session.payment_status !== 'paid') return null;

      const piRaw = session.payment_intent;
      const paymentIntent =
        typeof piRaw === 'string'
          ? await stripe.paymentIntents.retrieve(piRaw)
          : piRaw;
      if (!paymentIntent) return null;

      const received = paymentIntent.amount_received ?? paymentIntent.amount ?? 0;
      const refunded =
        'amount_refunded' in paymentIntent
          ? Number((paymentIntent as { amount_refunded?: number }).amount_refunded ?? 0)
          : 0;
      return Math.max(0, received - refunded);
    } catch (err) {
      this.logger.warn(
        `Lecture montant remboursable Stripe (${checkoutSessionId}): ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /** Remboursement (total ou partiel) sur le PaymentIntent de la session Checkout. */
  async refundCheckoutPayment(input: {
    checkoutSessionId: string;
    amountCents: number;
  }): Promise<{ refundId: string; amountCents: number }> {
    if (!Number.isFinite(input.amountCents) || input.amountCents < 1) {
      throw new BadRequestException('Montant de remboursement invalide.');
    }

    const stripe = this.client();
    const remaining = await this.getCheckoutRefundableCents(input.checkoutSessionId);
    if (remaining != null && input.amountCents > remaining) {
      throw new BadRequestException(
        `Le montant du remboursement (${(input.amountCents / 100).toFixed(2)} €) dépasse le montant encore remboursable (${(remaining / 100).toFixed(2)} €).`,
      );
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(input.checkoutSessionId, {
        expand: ['payment_intent'],
      });
      if (session.payment_status !== 'paid') {
        throw new BadRequestException('Le paiement Stripe n’est pas encaissé pour cette réservation.');
      }

      const pi = session.payment_intent;
      const paymentIntentId = typeof pi === 'string' ? pi : pi?.id;
      if (!paymentIntentId) {
        throw new BadRequestException('Paiement Stripe introuvable pour cette réservation.');
      }

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: input.amountCents,
      });

      this.logger.log(
        `Remboursement Stripe ${refund.id} (${(input.amountCents / 100).toFixed(2)} €) — session ${input.checkoutSessionId}`,
      );

      return {
        refundId: refund.id,
        amountCents: refund.amount ?? input.amountCents,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(stripeErrorMessageFr(err, 'Remboursement Stripe impossible.'));
    }
  }
}
