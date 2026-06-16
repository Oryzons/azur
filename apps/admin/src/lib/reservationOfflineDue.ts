import { rentalDaysBetween } from '@bleu-calanque/shared';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import { splitExtrasByPaymentChannel, sumExtrasEuros } from '@/lib/extraPricing';
import type { Extra } from '@/stores/extras';
import type { ReservationPaymentVisualContext } from '@/lib/reservationStatus';

/** Montant TTC des extras « hors ligne » sélectionnés (centimes). */
export function computeReservationOfflineDueCents(
  reservation: Reservation,
  extrasCatalog: readonly Extra[],
): number {
  const d = reservation.details;
  if (!d) return 0;
  const selectedIds = new Set(
    Object.entries(d.extras ?? {})
      .filter(([, on]) => Boolean(on))
      .map(([id]) => id),
  );
  const selected = extrasCatalog.filter((e) => selectedIds.has(e.id));
  const { offline } = splitExtrasByPaymentChannel(selected);
  if (offline.length === 0) return 0;
  const rental = Number.parseFloat(String(d.rentalPrice ?? '').replace(',', '.'));
  const rentalEuros = Number.isFinite(rental) ? rental : 0;
  const days = rentalDaysBetween(reservation.start, reservation.end);
  const euros = sumExtrasEuros(rentalEuros, offline, days);
  return Math.max(0, Math.round(euros * 100));
}

export function reservationPaymentContext(
  reservation: Reservation,
  extrasCatalog: readonly Extra[],
): ReservationPaymentVisualContext {
  return {
    installmentPlan: reservation.installmentPlan,
    offlineDueCents: computeReservationOfflineDueCents(reservation, extrasCatalog),
  };
}
