import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ComptabiliteOrDesk, DeskOnly } from '../common/decorators/role-groups.decorator';
import { CouponsAirbusExportService } from './coupons-airbus-export.service';
import { CouponsService } from './coupons.service';
import {
  CreateCouponDto,
  CreateRedemptionDto,
  RemoveClientRedemptionsDto,
  UpdateCouponDto,
} from './coupons.dto';

@Controller()
export class CouponsController {
  constructor(
    private readonly coupons: CouponsService,
    private readonly airbusExport: CouponsAirbusExportService,
  ) {}

  @Get('coupon-redemptions')
  @DeskOnly()
  listRedemptions() {
    return this.coupons.listRedemptions();
  }

  /** Suppression par client (chemin plat — évite conflit avec DELETE coupons/:id). */
  @Delete('coupon-redemptions/by-client')
  @DeskOnly()
  removeRedemptionsForClientByQuery(
    @Query('couponId', ParseUUIDPipe) couponId: string,
    @Query('clientKey') clientKey: string,
  ) {
    return this.coupons.removeRedemptionsForClient(couponId, { clientKey });
  }

  @Post('coupon-redemptions/remove-by-client')
  @DeskOnly()
  removeRedemptionsForClientByBody(@Body() body: RemoveClientRedemptionsDto) {
    return this.coupons.removeRedemptionsForClient(body.couponId, { clientKey: body.clientKey });
  }

  @Delete('coupon-redemptions')
  @DeskOnly()
  clearRedemptions() {
    return this.coupons.clearRedemptions();
  }

  @Get('coupons')
  @ComptabiliteOrDesk()
  listCoupons() {
    return this.coupons.list();
  }

  @Post('coupons')
  @DeskOnly()
  createCoupon(@Body() body: CreateCouponDto) {
    return this.coupons.create(body);
  }

  @Patch('coupons/:id')
  @DeskOnly()
  updateCoupon(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCouponDto) {
    return this.coupons.update(id, body);
  }

  @Post('coupons/:id/sync-redemptions')
  @DeskOnly()
  syncRedemptionsFromReservations(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.syncRedemptionsFromReservations(id);
  }

  @Get('coupons/:id/export/airbus-registrations')
  @DeskOnly()
  async exportAirbusRegistrations(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    await this.coupons.syncRedemptionsFromReservations(id);
    const { csv, filename } = await this.airbusExport.buildCsv(id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\uFEFF${csv}`);
  }

  @Post('coupons/:id/redemptions')
  @DeskOnly()
  createRedemption(@Param('id', ParseUUIDPipe) id: string, @Body() body: CreateRedemptionDto) {
    return this.coupons.createRedemption(id, body);
  }

  /** Routes imbriquées avant DELETE coupons/:id (ordre Nest). */
  @Delete('coupons/:id/redemptions')
  @DeskOnly()
  removeRedemptionsForClientNested(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('clientKey') clientKey: string,
  ) {
    return this.coupons.removeRedemptionsForClient(id, { clientKey });
  }

  @Delete('coupons/:id')
  @DeskOnly()
  removeCoupon(@Param('id', ParseUUIDPipe) id: string) {
    return this.coupons.remove(id);
  }
}
