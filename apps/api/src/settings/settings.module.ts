import { Module } from '@nestjs/common';
import { RentalContractsModule } from '../rental-contracts/rental-contracts.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [RentalContractsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
