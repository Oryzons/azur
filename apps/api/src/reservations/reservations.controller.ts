import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RentalContractsService } from '../rental-contracts/rental-contracts.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminOnly, DeskOnly, ReservationsRead } from '../common/decorators/role-groups.decorator';
import type { AuthUser } from '@bleu-calanque/shared';
import { ReservationsService } from './reservations.service';
import { CancelReservationDto, CreateReservationRefundDto, UpsertReservationDto } from './reservations.dto';

@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly rentalContracts: RentalContractsService,
  ) {}

  @Get()
  @ReservationsRead()
  list(@CurrentUser() user: AuthUser) {
    return this.reservations.list(user);
  }

  @Post()
  @DeskOnly()
  create(@Body() body: UpsertReservationDto) {
    return this.reservations.create(body);
  }

  @Post('sync-pending-stripe-payments')
  @DeskOnly()
  syncPendingStripePayments() {
    return this.reservations.syncPendingStripePayments();
  }

  @Put(':id')
  @DeskOnly()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpsertReservationDto) {
    return this.reservations.update(id, body);
  }

  @Get(':id/rental-contract/preview')
  @DeskOnly()
  async previewRentalContract(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { pdf, filename } = await this.rentalContracts.getPreviewPdfForReservation(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdf);
  }

  @Get(':id/rental-contract/download')
  @DeskOnly()
  async downloadRentalContract(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { pdf, filename, kind } = await this.rentalContracts.getContractPdfForReservation(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Contract-Pdf-Kind', kind);
    res.send(pdf);
  }

  @Post(':id/rental-contract/operator-signature')
  @DeskOnly()
  setOperatorSignature(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.rentalContracts.setOperatorSignature(id, body);
  }

  @Post(':id/rental-contract/resend-signed-email')
  @DeskOnly()
  resendSignedContractEmail(@Param('id', ParseUUIDPipe) id: string) {
    return this.rentalContracts.sendSignedContractEmail(id, { force: true });
  }

  @Post(':id/send-confirmation-email')
  @DeskOnly()
  sendConfirmationEmail(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservations.sendConfirmationEmail(id);
  }

  @Post(':id/send-contract-email')
  @DeskOnly()
  sendContractEmail(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservations.sendContractEmail(id);
  }

  @Post(':id/sync-stripe-payment')
  @DeskOnly()
  syncStripePayment(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservations.syncStripePayment(id);
  }

  @Post(':id/refund')
  @DeskOnly()
  issueRefund(@Param('id', ParseUUIDPipe) id: string, @Body() body: CreateReservationRefundDto) {
    return this.reservations.issueRefund(id, body);
  }

  @Post(':id/resolve')
  @DeskOnly()
  resolveReservation(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.reservations.resolveReservation(id, body);
  }

  @Post(':id/cancel')
  @DeskOnly()
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() body: CancelReservationDto) {
    return this.reservations.cancel(id, body);
  }

  @Post(':id/restore')
  @DeskOnly()
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservations.restore(id);
  }

  @Delete(':id')
  @DeskOnly()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservations.remove(id);
  }

  @Delete()
  @AdminOnly()
  clearAll() {
    return this.reservations.clearAll();
  }
}
