/** Réservation considérée comme payée pour signature / envoi du contrat. */
export function isReservationPaidForContract(ctx: {
  paymentCapturedAt?: Date | string | null;
  status?: string | null;
}): boolean {
  if (ctx.paymentCapturedAt) {
    const d = ctx.paymentCapturedAt instanceof Date ? ctx.paymentCapturedAt : new Date(ctx.paymentCapturedAt);
    if (!Number.isNaN(d.getTime())) return true;
  }
  const s = ctx.status;
  if (!s) return false;
  return s === 'RESERVED_PAID' || s === 'reserved_paid';
}
