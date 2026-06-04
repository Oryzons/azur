import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CheckFlowKind, InternalNotificationKind, Prisma } from '@prisma/client';
import { UserRole, type AuthUser, isOwnerRole } from '@bleu-calanque/shared';
import { OwnerScopeService } from '../common/auth/owner-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildNotificationCopy,
  diffReservationNotificationEvents,
  eventToInternalKind,
  settingsAllowsKind,
} from './reservation-notification-events';

const NOTIF_SETTINGS_ID = 'notifications_settings';

type CheckFlowSubmissionRow = {
  id: string;
  kind: CheckFlowKind;
  reservationId: string;
  submittedAt: Date;
  reservation: {
    title: string;
    startAt: Date;
    boat: { name: string; brand: string } | null;
  };
  submittedBy: { firstName: string; lastName: string } | null;
};

@Injectable()
export class InternalNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownerScope: OwnerScopeService,
  ) {}

  async list(user: AuthUser, params: { since?: Date; limit?: number }) {
    const where: Prisma.InternalNotificationWhereInput = isOwnerRole(user.role)
      ? { recipientUserId: user.id }
      : { recipientUserId: null };
    if (params.since) {
      where.createdAt = { gt: params.since };
    }
    return this.prisma.internalNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 80,
    });
  }

  async markRead(user: AuthUser, id: string) {
    const existing = await this.prisma.internalNotification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Notification introuvable.');
    if (isOwnerRole(user.role) && existing.recipientUserId !== user.id) {
      throw new ForbiddenException('Notification inaccessible.');
    }
    if (!isOwnerRole(user.role) && existing.recipientUserId != null) {
      throw new ForbiddenException('Notification inaccessible.');
    }
    return this.prisma.internalNotification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllRead(user: AuthUser) {
    const where: Prisma.InternalNotificationWhereInput = isOwnerRole(user.role)
      ? { recipientUserId: user.id, read: false }
      : { recipientUserId: null, read: false };
    await this.prisma.internalNotification.updateMany({
      where,
      data: { read: true },
    });
    return { ok: true };
  }

  async clearAll(user: AuthUser) {
    const where: Prisma.InternalNotificationWhereInput = isOwnerRole(user.role)
      ? { recipientUserId: user.id }
      : { recipientUserId: null };
    await this.prisma.internalNotification.deleteMany({ where });
    return { ok: true };
  }

  async createFromCheckFlowSubmission(submission: CheckFlowSubmissionRow) {
    const settings = await this.prisma.notificationsSettings.findUnique({
      where: { id: NOTIF_SETTINGS_ID },
    });
    const onCheckIn = settings?.onCheckInDone ?? true;
    const onCheckOut = settings?.onCheckOutDone ?? true;
    if (submission.kind === 'CHECK_IN' && !onCheckIn) return null;
    if (submission.kind === 'CHECK_OUT' && !onCheckOut) return null;

    const kind: InternalNotificationKind =
      submission.kind === 'CHECK_IN' ? 'CHECK_IN_DONE' : 'CHECK_OUT_DONE';
    const boat = submission.reservation.boat
      ? `${submission.reservation.boat.brand} ${submission.reservation.boat.name}`.trim()
      : 'Bateau';
    const clientName = submission.reservation.title?.trim() || 'Client';
    const agent = submission.submittedBy
      ? `${submission.submittedBy.firstName} ${submission.submittedBy.lastName}`.trim()
      : 'Agent';
    const when = submission.reservation.startAt.toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const title = submission.kind === 'CHECK_IN' ? 'Check-in effectué' : 'Check-out effectué';
    const message =
      submission.kind === 'CHECK_IN'
        ? `${clientName} — ${boat} · départ ${when} · par ${agent}`
        : `${clientName} — ${boat} · retour · par ${agent}`;

    return this.prisma.internalNotification.create({
      data: {
        kind,
        title,
        message,
        recipientUserId: null,
        reservationId: submission.reservationId,
        submissionId: submission.id,
        boatName: boat,
        clientName,
        href: `/check-flow/historique?id=${submission.id}`,
      },
    });
  }

  async createFromRentalContractSigned(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { boat: true },
    });
    if (!reservation) return null;

    const contract = await this.prisma.reservationRentalContract.findUnique({
      where: { reservationId },
      select: { signedAt: true, contractNumber: true },
    });
    if (!contract?.signedAt) return null;

    const copy = buildNotificationCopy('RENTAL_CONTRACT_SIGNED', reservation);
    return this.createReservationNotification(reservation, 'RENTAL_CONTRACT_SIGNED', {
      title: copy.title,
      message: `${copy.message} · contrat n°${contract.contractNumber}`,
    });
  }

  async createFromOnlinePayment(reservationId: string) {
    const settings = await this.prisma.notificationsSettings.findUnique({
      where: { id: NOTIF_SETTINGS_ID },
    });
    if (!(settings?.onPaymentCaptured ?? true)) return null;

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { boat: true },
    });
    if (!reservation) return null;

    const recent = await this.prisma.internalNotification.findFirst({
      where: {
        kind: 'PAYMENT_ONLINE_CAPTURED',
        reservationId,
        createdAt: { gt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) return recent;

    const boat = reservation.boat
      ? `${reservation.boat.brand} ${reservation.boat.name}`.trim()
      : 'Bateau';
    const clientName =
      [reservation.clientFirstName, reservation.clientLastName].filter(Boolean).join(' ').trim() ||
      reservation.title?.trim() ||
      'Client';
    const when = reservation.startAt.toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const total =
      reservation.totalDueCents != null
        ? `${(reservation.totalDueCents / 100).toFixed(2).replace('.', ',')} €`
        : '';

    return this.createReservationNotification(reservation, 'PAYMENT_ONLINE_CAPTURED', {
      title: 'Paiement en ligne reçu',
      message: `${clientName} — ${boat} · départ ${when}${total ? ` · ${total}` : ''}`,
    });
  }

  async emitReservationChangeNotifications(
    before: Prisma.ReservationGetPayload<{ include: { boat: true; refunds: true } }> | null,
    after: Prisma.ReservationGetPayload<{ include: { boat: true; refunds: true } }> | null,
  ) {
    const settings = await this.prisma.notificationsSettings.findUnique({
      where: { id: NOTIF_SETTINGS_ID },
    });
    const events = diffReservationNotificationEvents(before, after);
    for (const event of events) {
      const kind = eventToInternalKind(event);
      if (!settingsAllowsKind(settings, kind)) continue;
      const row = after ?? before;
      if (!row) continue;
      await this.createReservationNotification(row, kind);
      if (event === 'RESERVATION_CREATED') {
        await this.notifyOwnersOnReservation(row);
      }
    }
  }

  async notifyOwnersOnReservation(
    reservation: Prisma.ReservationGetPayload<{ include: { boat: true } }>,
  ) {
    const ownerUserIds = await this.ownerScope.findOwnerUserIdsForBoat(reservation.boatId);
    if (ownerUserIds.length === 0) return;

    const boat = reservation.boat
      ? `${reservation.boat.brand} ${reservation.boat.name}`.trim()
      : 'Bateau';
    const clientName =
      [reservation.clientFirstName, reservation.clientLastName].filter(Boolean).join(' ').trim() ||
      reservation.title?.trim() ||
      'Client';
    const when = reservation.startAt.toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const recipientUserId of ownerUserIds) {
      await this.prisma.internalNotification.create({
        data: {
          kind: 'RESERVATION_ON_OWNER_BOAT',
          title: 'Nouvelle réservation sur votre bateau',
          message: `${clientName} — ${boat} · départ ${when}`,
          recipientUserId,
          reservationId: reservation.id,
          boatName: boat,
          clientName,
          href: `/calendrier?open=${encodeURIComponent(reservation.id)}`,
        },
      });
    }
  }

  async emitUnavailabilityChange(
    action: 'created' | 'updated' | 'deleted',
    row: Prisma.BoatUnavailabilityGetPayload<{ include: { boat: true } }>,
    actor: AuthUser,
  ) {
    const kind: InternalNotificationKind =
      action === 'created'
        ? 'UNAVAILABILITY_CREATED'
        : action === 'updated'
          ? 'UNAVAILABILITY_UPDATED'
          : 'UNAVAILABILITY_DELETED';

    const boat = row.boat ? `${row.boat.brand} ${row.boat.name}`.trim() : 'Bateau';
    const when = row.startAt.toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const actorLabel =
      actor.role === UserRole.OWNER
        ? 'Propriétaire'
        : `${actor.firstName} ${actor.lastName}`.trim() || 'Équipe';

    const title =
      action === 'created'
        ? 'Indisponibilité ajoutée'
        : action === 'updated'
          ? 'Indisponibilité modifiée'
          : 'Indisponibilité supprimée';

    const message = `${row.title} — ${boat} · ${when} · par ${actorLabel}`;

    await this.prisma.internalNotification.create({
      data: {
        kind,
        title,
        message,
        recipientUserId: null,
        unavailabilityId: row.id,
        boatName: boat,
        href: `/calendrier?unavail=${encodeURIComponent(row.id)}`,
      },
    });

    const ownerUserIds = await this.ownerScope.findOwnerUserIdsForBoat(row.boatId);
    if (actor.role === UserRole.OWNER) return;
    for (const recipientUserId of ownerUserIds) {
      await this.prisma.internalNotification.create({
        data: {
          kind,
          title: action === 'created' ? 'Indisponibilité sur votre bateau' : title,
          message,
          recipientUserId,
          unavailabilityId: row.id,
          boatName: boat,
          href: `/calendrier?unavail=${encodeURIComponent(row.id)}`,
        },
      });
    }
  }

  private async createReservationNotification(
    reservation: Prisma.ReservationGetPayload<{ include: { boat: true } }>,
    kind: InternalNotificationKind,
    copyOverride?: { title: string; message: string },
  ) {
    const settings = await this.prisma.notificationsSettings.findUnique({
      where: { id: NOTIF_SETTINGS_ID },
    });
    if (!settingsAllowsKind(settings, kind)) return null;

    const recent = await this.prisma.internalNotification.findFirst({
      where: {
        kind,
        reservationId: reservation.id,
        createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) return recent;

    const { title, message } = copyOverride ?? buildNotificationCopy(kind, reservation);
    const boat = reservation.boat
      ? `${reservation.boat.brand} ${reservation.boat.name}`.trim()
      : 'Bateau';
    const clientName =
      [reservation.clientFirstName, reservation.clientLastName].filter(Boolean).join(' ').trim() ||
      reservation.title?.trim() ||
      'Client';

    return this.prisma.internalNotification.create({
      data: {
        kind,
        title,
        message,
        recipientUserId: null,
        reservationId: reservation.id,
        boatName: boat,
        clientName,
        href: `/calendrier?open=${encodeURIComponent(reservation.id)}`,
      },
    });
  }
}
