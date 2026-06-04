import { BadRequestException, Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RentalContractsService } from '../rental-contracts/rental-contracts.service';
import { ReservationNotificationsService } from './reservation-notifications.service';
import { StripePaymentsService } from './stripe-payments.service';

@Controller('public/payments')
export class PublicPaymentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripePaymentsService,
    private readonly reservationNotifications: ReservationNotificationsService,
    private readonly rentalContracts: RentalContractsService,
  ) {}

  /**
   * Page succès : le navigateur ne fournit qu’un identifiant de session ;
   * le statut et le montant sont toujours relus via l’API Stripe + validation serveur.
   */
  @Public()
  @Get('success')
  async success(@Query('session_id') sessionId?: string) {
    if (!sessionId?.trim()) {
      throw new NotFoundException('Session de paiement introuvable.');
    }

    if (!this.stripe.isConfigured()) {
      throw new NotFoundException('Paiement en ligne non configuré.');
    }

    const sid = sessionId.trim();
    const summary = await this.stripe.getSessionSummary(sid);
    if (!summary.reservationId) {
      throw new NotFoundException('Réservation introuvable pour cette session.');
    }

    if (summary.paymentStatus === 'paid') {
      const confirmed = await this.reservationNotifications.confirmPaymentFromCheckoutSession(sid);
      if (!confirmed) {
        throw new BadRequestException(
          'Paiement Stripe reçu mais non validé (montant ou session incohérents). Contactez la base.',
        );
      }
    }

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: summary.reservationId },
      include: { boat: true },
    });
    if (!reservation) throw new NotFoundException('Réservation introuvable.');

    const contract = await this.rentalContracts.ensureForReservation(reservation.id);
    const signUrl = this.rentalContracts.signUrl(contract.signToken);
    const paid = reservation.status === 'RESERVED_PAID' && reservation.paymentCapturedAt != null;

    return {
      paid,
      reservation: {
        id: reservation.id,
        boatName: reservation.boat.name,
        startAt: reservation.startAt.toISOString(),
        endAt: reservation.endAt.toISOString(),
        clientFirstName: reservation.clientFirstName,
        clientLastName: reservation.clientLastName,
        status: reservation.status,
      },
      contract: {
        number: contract.contractNumber,
        signed: Boolean(contract.signedAt),
        signUrl,
      },
    };
  }
}
