import { Module, forwardRef } from '@nestjs/common';
import { InternalNotificationsModule } from '../internal-notifications/internal-notifications.module';
import { RentalContractsModule } from '../rental-contracts/rental-contracts.module';
import { ResendMailService } from './resend-mail.service';
import { StripePaymentsService } from './stripe-payments.service';
import { ReservationNotificationsService } from './reservation-notifications.service';
import { PublicPaymentsController } from './public-payments.controller';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [InternalNotificationsModule, forwardRef(() => RentalContractsModule)],
  controllers: [PublicPaymentsController, StripeWebhookController],
  providers: [ResendMailService, StripePaymentsService, ReservationNotificationsService],
  exports: [ReservationNotificationsService],
})
export class NotificationsModule {}
