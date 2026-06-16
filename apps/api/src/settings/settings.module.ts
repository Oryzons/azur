import { Module } from '@nestjs/common';
import { RentalContractsModule } from '../rental-contracts/rental-contracts.module';
import { UsersModule } from '../users/users.module';
import { OwnerPortalController } from './owner-portal.controller';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [RentalContractsModule, UsersModule],
  controllers: [SettingsController, OwnerPortalController],
  providers: [SettingsService],
})
export class SettingsModule {}
