import { overlaps } from '@/pages/calendar/calendarConstants';
import type { ExtraRental } from '@/stores/extraRentals';

/** Locations d'extras seules actives sur une période calendrier. */
export function extraRentalsForPeriod(items: ExtraRental[], start: Date, end: Date) {
  return items.filter((r) => {
    if (r.status === 'CANCELLED') return false;
    return overlaps(new Date(r.startAt), new Date(r.endAt), start, end);
  });
}
