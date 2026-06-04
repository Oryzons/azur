import type { Reservation } from '@/pages/calendar/reservationTypes';

export function normalizeClientEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? '';
}

/** Associe une réservation à un client catalogue (id membre ou même email). */
export function reservationMatchesClient(
  r: Reservation,
  opts: Readonly<{ memberId?: string | null; email?: string | null }>,
): boolean {
  const d = r.details;
  if (!d) return false;
  const linkedId = d.linkedMemberId?.trim();
  const memberId = opts.memberId?.trim();
  if (memberId && linkedId === memberId) return true;
  const resEmail = normalizeClientEmail(d.clientEmail);
  const targetEmail = normalizeClientEmail(opts.email);
  return Boolean(resEmail && targetEmail && resEmail === targetEmail);
}

export function reservationsForClient(
  reservations: Reservation[],
  opts: Readonly<{ memberId?: string | null; email?: string | null; excludeId?: string | null }>,
): Reservation[] {
  const excludeId = opts.excludeId?.trim();
  return reservations
    .filter((r) => {
      if (excludeId && r.id === excludeId) return false;
      return reservationMatchesClient(r, opts);
    })
    .sort((a, b) => b.start.getTime() - a.start.getTime());
}
