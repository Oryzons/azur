import { Module } from '@nestjs/common';
import { InternalNotificationsModule } from '../internal-notifications/internal-notifications.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalContractsModule } from '../rental-contracts/rental-contracts.module';
import { CouponsModule } from '../coupons/coupons.module';
import { MemberCreditsModule } from '../member-credits/member-credits.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [NotificationsModule, InternalNotificationsModule, RentalContractsModule, CouponsModule, MemberCreditsModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}
