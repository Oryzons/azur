import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { StripePaymentsService } from './stripe-payments.service';
import { ReservationNotificationsService } from './reservation-notifications.service';

@SkipThrottle()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripePaymentsService,
    private readonly notifications: ReservationNotificationsService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    const raw = req.body;
    if (!(raw instanceof Buffer) || raw.length === 0) {
      throw new BadRequestException(
        'Webhook Stripe : corps brut requis (vérifier le middleware express.raw sur cette route).',
      );
    }
    if (!signature?.trim()) {
      throw new BadRequestException('Webhook Stripe : en-tête stripe-signature manquant.');
    }

    const event = this.stripe.constructWebhookEvent(raw, signature);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.object === 'checkout.session' && typeof session.id === 'string') {
        const confirmed = await this.notifications.confirmPaymentFromCheckoutSession(session.id);
        if (!confirmed) {
          this.logger.warn(`checkout.session.completed non appliqué (session ${session.id})`);
        }
      }
    }

    return { received: true };
  }
}
