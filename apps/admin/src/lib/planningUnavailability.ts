import { overlaps } from '@/pages/calendar/calendarConstants';
import type { BoatUnavailability } from '@/stores/unavailabilities';

export function unavailabilitiesForBoatPeriod(
  items: BoatUnavailability[],
  boatId: string,
  periodStart: Date,
  periodEnd: Date,
): BoatUnavailability[] {
  return items.filter((u) => {
    if (u.boatId !== boatId) return false;
    const start = new Date(u.startAt);
    const end = new Date(u.endAt);
    return overlaps(start, end, periodStart, periodEnd);
  });
}
