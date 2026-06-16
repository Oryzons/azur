/** Contexte pour décider si une réservation est figée côté back-office. */
export type ReservationLockContext = {
  endAt: Date | string;
  paymentCapturedAt?: Date | string | null;
  /** Statut API Prisma (`RESERVED_PAID`, …). */
  status?: string | null;
  /** Statut admin (`reserved_paid`, …). */
  adminStatus?: string | null;
  cancelledAt?: Date | string | null;
  checkInDone: boolean;
  checkOutDone: boolean;
};

export function isReservationPaid(ctx: Pick<ReservationLockContext, 'paymentCapturedAt' | 'status' | 'adminStatus'>): boolean {
  if (ctx.paymentCapturedAt) return true;
  const s = ctx.adminStatus ?? ctx.status;
  if (!s) return false;
  const paidStatuses = new Set([
    'reserved_paid',
    'RESERVED_PAID',
    'refunded',
    'REFUNDED',
    'partially_refunded',
    'PARTIALLY_REFUNDED',
  ]);
  return paidStatuses.has(s);
}

export function isReservationPastEnd(endAt: Date | string, now: Date = new Date()): boolean {
  const end = endAt instanceof Date ? endAt : new Date(endAt);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() < now.getTime();
}

/** Location clôturée : payée, créneau terminé, check-in et check-out effectués. */
export function isReservationLocked(ctx: ReservationLockContext): boolean {
  return (
    isReservationPaid(ctx) &&
    isReservationPastEnd(ctx.endAt) &&
    ctx.checkInDone &&
    ctx.checkOutDone
  );
}

export function getReservationLockMessage(ctx: ReservationLockContext): string | null {
  const status = ctx.adminStatus ?? ctx.status;
  const cancelled = Boolean(ctx.cancelledAt);
  if (status === 'refunded' || status === 'REFUNDED') {
    return cancelled
      ? 'Réservation annulée et remboursée — modification encore possible.'
      : 'Location remboursée — modification encore possible.';
  }
  if (status === 'partially_refunded' || status === 'PARTIALLY_REFUNDED') {
    return cancelled
      ? 'Réservation annulée — remboursement partiel enregistré.'
      : 'Remboursement partiel enregistré — modification encore possible.';
  }
  if (isReservationLocked(ctx)) {
    return 'Location terminée, payée, check-in et check-out effectués — modification bloquée.';
  }
  if (isReservationPaid(ctx) && isReservationPastEnd(ctx.endAt)) {
    const missing: string[] = [];
    if (!ctx.checkInDone) missing.push('check-in');
    if (!ctx.checkOutDone) missing.push('check-out');
    if (missing.length > 0) {
      return `Location terminée et payée : ${missing.join(' et ')} non effectué(s) — modification encore possible.`;
    }
  }
  return null;
}
