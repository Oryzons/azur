import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DeskOnly } from '../common/decorators/role-groups.decorator';
import { CouponsAirbusExportService } from './coupons-airbus-export.service';
import { CouponsService } from './coupons.service';
import {
  CreateCouponDto,
  CreateRedemptionDto,
  RemoveClientRedemptionsDto,
  UpdateCouponDto,
} from './coupons.dto';

@Controller()
@DeskOnly()
export class CouponsController {
  constructor(
    private readonly coupons: CouponsService,
    private readonly airbusExport: CouponsAirbusExportService,
  ) {}

  @Get('coupon-redemptions')
  listRedemptions() {
    return this.coupons.listRedemptions();
  }

  /** Suppression par client (chemin plat — évite conflit avec DELETE coupons/:id). */
  @Delete('coupon-redemptions/by-client')
  removeRedemptionsForClientByQuery(
    @Query('couponId', ParseUUIDPipe) couponId: string,
    @Query('clientKey') clientKey: string,
  ) {
    return this.coupons.removeRedemptionsForClient(couponId, { clientKey });
  }

  @Post('coupon-redemptions/remove-by-client')
  removeRedemptionsForClientByBody(@Body() body: RemoveClientRedemptionsDto) {
    return this.coupons.removeRedemptionsForClient(body.couponId, { clientKey: body.clientKey });
  }

  @Delete('coupon-redemptions')
  clearRedemptions() {
    return this.coupons.clearRedemptions();
  }

  @Get('coupons')
  listCoupons() {
    return this.coupons.list();
  }

  @Post('coupons')
  createCoupon(@Body() body: CreateCouponDto) {
    return this.coupons.create(body);
  }

  @Patch('coupons/:id')
  updateCoupon(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCouponDto) {
    return this.coupons.update(id, body);
  }

  @Post('coupons/:id/sync-redemptions')
  syncRedemptionsFromReservations(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.syncRedemptionsFromReservations(id);
  }

  @Get('coupons/:id/export/airbus-registrations')
  async exportAirbusRegistrations(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    await this.coupons.syncRedemptionsFromReservations(id);
    const { csv, filename } = await this.airbusExport.buildCsv(id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\uFEFF${csv}`);
  }

  @Post('coupons/:id/redemptions')
  createRedemption(@Param('id', ParseUUIDPipe) id: string, @Body() body: CreateRedemptionDto) {
    return this.coupons.createRedemption(id, body);
  }

  /** Routes imbriquées avant DELETE coupons/:id (ordre Nest). */
  @Delete('coupons/:id/redemptions')
  removeRedemptionsForClientNested(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('clientKey') clientKey: string,
  ) {
    return this.coupons.removeRedemptionsForClient(id, { clientKey });
  }

  @Delete('coupons/:id')
  removeCoupon(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.remove(id);
  }
}
