import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsAirbusExportService } from './coupons-airbus-export.service';
import { CouponsService } from './coupons.service';

@Module({
  controllers: [CouponsController],
  providers: [CouponsService, CouponsAirbusExportService],
  exports: [CouponsService],
})
export class CouponsModule {}
