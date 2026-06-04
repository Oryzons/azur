import { Module } from '@nestjs/common';
import { BoatUnavailabilitiesController } from './boat-unavailabilities.controller';
import { BoatUnavailabilitiesService } from './boat-unavailabilities.service';
import { InternalNotificationsModule } from '../internal-notifications/internal-notifications.module';

@Module({
  imports: [InternalNotificationsModule],
  controllers: [BoatUnavailabilitiesController],
  providers: [BoatUnavailabilitiesService],
  exports: [BoatUnavailabilitiesService],
})
export class BoatUnavailabilitiesModule {}
