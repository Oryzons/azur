import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RentalContractsService } from '../rental-contracts/rental-contracts.service';
import { RefundReceiptService } from './refund-receipt.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminOnly, ComptabiliteOrDesk, DeskOnly, ReservationsRead } from '../common/decorators/role-groups.decorator';
import type { AuthUser } from '@bleu-calanque/shared';
import { ReservationsService } from './reservations.service';
import { CancelReservationDto, CreateReservationRefundDto, SettleInstallmentDto, SettleSupplementDto, UpsertReservationDto } from './reservations.dto';
import { StripePaymentsService } from '../notifications/stripe-payments.service';

@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly rentalContracts: RentalContractsService,
    private readonly refundReceipts: RefundReceiptService,
    private readonly stripe: StripePaymentsService,
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

  @Post('sync-stripe-fees')
  @ComptabiliteOrDesk()
  syncStripeFees() {
    return this.reservations.syncStripeFees();
  }

  @Get('stripe-balance')
  @ReservationsRead()
  async stripeBalance() {
    if (!this.stripe.isConfigured()) {
      return { configured: false as const };
    }
    try {
      const balance = await this.stripe.getAccountBalance();
      return { configured: true as const, balance };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lecture du solde Stripe impossible.';
      return { configured: true as const, error: message };
    }
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

  @Get(':id/refund-receipt/download')
  @DeskOnly()
  async downloadRefundReceipt(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { pdf, filename } = await this.refundReceipts.getPdfForReservation(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
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

  @Post(':id/sync-stripe-refunds')
  @DeskOnly()
  syncStripeRefunds(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservations.syncStripeRefunds(id);
  }

  @Post(':id/installments/:sequence/settle')
  @DeskOnly()
  settleInstallment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sequence') sequence: string,
    @Body() body: SettleInstallmentDto,
  ) {
    return this.reservations.settleInstallment(id, Number(sequence), body.paid ?? true);
  }

  @Post(':id/supplement/settle')
  @DeskOnly()
  settleSupplement(@Param('id', ParseUUIDPipe) id: string, @Body() body: SettleSupplementDto) {
    return this.reservations.settleSupplement(id, body);
  }

  @Post(':id/supplement/send-payment-email')
  @DeskOnly()
  sendSupplementPaymentEmail(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservations.sendSupplementPaymentEmail(id);
  }

  @Post(':id/offline/settle')
  @DeskOnly()
  settleOfflineDue(@Param('id', ParseUUIDPipe) id: string, @Body() body: SettleSupplementDto) {
    return this.reservations.settleOfflineDue(id, body);
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
