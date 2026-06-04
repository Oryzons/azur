import type { Reservation, ReservationRefund } from '@prisma/client';

export function reservationAuditSnapshot(r: {
  id: string;
  boatId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  status: string;
  clientEmail?: string | null;
  clientFirstName?: string | null;
  clientLastName?: string | null;
  rentalPriceCents?: number | null;
  cancelledAt?: Date | null;
}) {
  return {
    id: r.id,
    boatId: r.boatId,
    title: r.title,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    status: r.status,
    clientEmail: r.clientEmail,
    clientName: [r.clientFirstName, r.clientLastName].filter(Boolean).join(' ') || null,
    rentalPriceCents: r.rentalPriceCents,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
  };
}

export function refundsAuditSnapshot(refunds: Pick<ReservationRefund, 'amountCents' | 'note' | 'refundedAt'>[]) {
  return refunds.map((r) => ({
    amountCents: r.amountCents,
    amountEur: r.amountCents / 100,
    note: r.note,
    refundedAt: r.refundedAt.toISOString(),
  }));
}

export function entityIdNameSnapshot(row: {
  id: string;
  name?: string | null;
  title?: string | null;
  email?: string | null;
  code?: string | null;
}) {
  return {
    id: row.id,
    name: row.name ?? row.title ?? row.email ?? row.code ?? null,
  };
}
