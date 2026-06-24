import { Module } from '@nestjs/common';
import { ExtrasModule } from '../extras/extras.module';
import { ExtraRentalsController } from './extra-rentals.controller';
import { ExtraRentalsService } from './extra-rentals.service';

@Module({
  imports: [ExtrasModule],
  controllers: [ExtraRentalsController],
  providers: [ExtraRentalsService],
  exports: [ExtraRentalsService],
})
export class ExtraRentalsModule {}
