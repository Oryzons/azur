import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DeskOnly } from '../common/decorators/role-groups.decorator';
import { ResourceIdPipe } from '../common/pipes/resource-id.pipe';
import { PricingService } from './pricing.service';
import {
  CreatePricingPeriodDto,
  UpdatePricingPeriodDto,
  UpsertBoatPriceDto,
  UpsertFleetPriceDto,
} from './pricing.dto';

@Controller()
@DeskOnly()
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('pricing-periods')
  listPeriods() {
    return this.pricing.listPeriods();
  }

  @Post('pricing-periods')
  createPeriod(@Body() body: CreatePricingPeriodDto) {
    return this.pricing.createPeriod(body);
  }

  @Patch('pricing-periods/:id')
  updatePeriod(@Param('id', ResourceIdPipe) id: string, @Body() body: UpdatePricingPeriodDto) {
    return this.pricing.updatePeriod(id, body);
  }

  @Delete('pricing-periods/:id')
  removePeriod(@Param('id', ResourceIdPipe) id: string) {
    return this.pricing.removePeriod(id);
  }

  @Get('boat-prices')
  listPrices() {
    return this.pricing.listPrices();
  }

  @Post('pricing-periods/:periodId/prices')
  upsertPrice(@Param('periodId', ResourceIdPipe) periodId: string, @Body() body: UpsertBoatPriceDto) {
    return this.pricing.upsertPrice(periodId, body);
  }

  @Delete('pricing-periods/:periodId/prices/:boatId/:unit')
  deletePrice(
    @Param('periodId', ResourceIdPipe) periodId: string,
    @Param('boatId') boatId: string,
    @Param('unit') unit: string,
  ) {
    return this.pricing.deletePrice(periodId, boatId, unit);
  }

  @Get('fleet-prices')
  listFleetPrices() {
    return this.pricing.listFleetPrices();
  }

  @Post('pricing-periods/:periodId/fleet-prices')
  upsertFleetPrice(
    @Param('periodId', ResourceIdPipe) periodId: string,
    @Body() body: UpsertFleetPriceDto,
  ) {
    return this.pricing.upsertFleetPrice(periodId, body);
  }

  @Delete('pricing-periods/:periodId/fleet-prices/:fleetId/:unit')
  deleteFleetPrice(
    @Param('periodId', ResourceIdPipe) periodId: string,
    @Param('fleetId') fleetId: string,
    @Param('unit') unit: string,
  ) {
    return this.pricing.deleteFleetPrice(periodId, fleetId, unit);
  }
}
