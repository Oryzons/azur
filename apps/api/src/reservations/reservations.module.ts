import { Module } from '@nestjs/common';
import { ExtrasModule } from '../extras/extras.module';
import { InternalNotificationsModule } from '../internal-notifications/internal-notifications.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalContractsModule } from '../rental-contracts/rental-contracts.module';
import { CouponsModule } from '../coupons/coupons.module';
import { MemberCreditsModule } from '../member-credits/member-credits.module';
import { ReservationsController } from './reservations.controller';
import { RefundReceiptService } from './refund-receipt.service';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [
    ExtrasModule,
    NotificationsModule,
    InternalNotificationsModule,
    RentalContractsModule,
    CouponsModule,
    MemberCreditsModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService, RefundReceiptService],
})
export class ReservationsModule {}
