import { overlaps } from '@/pages/calendar/calendarConstants';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import {
  isReservationCancelled,
  resolveReservationStatus,
  RESERVATION_STATUSES,
  type ReservationStatus,
} from '@/lib/reservationStatus';
import {
  sortBoatsByFleetThenGlobalOrder,
  sortBoatsByGlobalOrder,
  type FleetRef,
} from '@/lib/calendarBoatOrder';
import type { Boat as StoreBoat, BoatType } from '@/stores/boats';

export type CalendarSortMode = 'custom' | 'fleet' | 'alpha';

export type CalendarBoatRow = {
  id: string;
  name: string;
  meta?: string;
  fleetId?: string | null;
  coverPhotoUrl?: string | null;
};

export type CalendarFilterState = {
  fleetId: string;
  boatType: '' | BoatType;
  boatId: string;
  ownerId: string;
  search: string;
  hiddenBoatIds: Set<string>;
  sortMode: CalendarSortMode;
  hiddenStatuses: Set<ReservationStatus>;
  onlyWithReservationsInPeriod: boolean;
};

export const DEFAULT_CALENDAR_FILTER_STATE: CalendarFilterState = {
  fleetId: '',
  boatType: '',
  boatId: '',
  ownerId: '',
  search: '',
  hiddenBoatIds: new Set(),
  sortMode: 'fleet',
  hiddenStatuses: new Set(['cancelled']),
  onlyWithReservationsInPeriod: false,
};

const inputCls =
  'w-full rounded-2xl border border-zinc-200/90 bg-white px-4 py-3 text-[15px] text-zinc-900 shadow-sm outline-none transition-colors focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';

export { inputCls };

export function countCalendarActiveFilters(state: CalendarFilterState): number {
  let n = 0;
  if (state.fleetId) n += 1;
  if (state.boatType) n += 1;
  if (state.boatId) n += 1;
  if (state.ownerId) n += 1;
  if (state.search.trim()) n += 1;
  if (state.hiddenBoatIds.size > 0) n += 1;
  if (state.sortMode !== 'fleet') n += 1;
  if (state.onlyWithReservationsInPeriod) n += 1;
  if (state.hiddenStatuses.size > 0) n += 1;
  return n;
}

export function filterCalendarBoats(
  boats: CalendarBoatRow[],
  storeBoats: StoreBoat[],
  state: Pick<CalendarFilterState, 'fleetId' | 'boatType' | 'boatId' | 'ownerId' | 'search'>,
): CalendarBoatRow[] {
  let list = boats;
  if (state.fleetId) {
    const allowed = new Set(
      storeBoats.filter((b) => (b.fleetId ?? '') === state.fleetId).map((b) => b.id),
    );
    list = list.filter((b) => allowed.has(b.id));
  }
  if (state.boatType) {
    const allowed = new Set(storeBoats.filter((b) => b.boatType === state.boatType).map((b) => b.id));
    list = list.filter((b) => allowed.has(b.id));
  }
  if (state.boatId) {
    list = list.filter((b) => b.id === state.boatId);
  }
  if (state.ownerId) {
    const allowed = new Set(
      storeBoats.filter((b) => (b.ownerId ?? '') === state.ownerId).map((b) => b.id),
    );
    list = list.filter((b) => allowed.has(b.id));
  }
  const q = state.search.trim().toLowerCase();
  if (q) {
    const metaById = new Map(storeBoats.map((b) => [b.id, `${b.brand} ${b.model} ${b.name}`.toLowerCase()]));
    list = list.filter((b) => {
      const hay = `${b.name} ${b.meta ?? ''} ${metaById.get(b.id) ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }
  return list;
}

export function applyCalendarBoatVisibility(
  boats: CalendarBoatRow[],
  state: Pick<CalendarFilterState, 'hiddenBoatIds' | 'onlyWithReservationsInPeriod'>,
  reservations: Reservation[],
  period: { start: Date; end: Date },
): CalendarBoatRow[] {
  let list = boats.filter((b) => !state.hiddenBoatIds.has(b.id));
  if (state.onlyWithReservationsInPeriod) {
    const busy = new Set(
      reservations
        .filter((r) => overlaps(r.start, r.end, period.start, period.end))
        .map((r) => r.boatId),
    );
    list = list.filter((b) => busy.has(b.id));
  }
  return list;
}

export function sortCalendarBoats(
  boats: CalendarBoatRow[],
  sortMode: CalendarSortMode,
  globalOrder: string[],
  fleets: readonly FleetRef[],
  hasCatalog: boolean,
): CalendarBoatRow[] {
  if (sortMode === 'alpha') {
    return [...boats].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
  if (sortMode === 'fleet' && hasCatalog) {
    return sortBoatsByFleetThenGlobalOrder(boats, fleets, globalOrder);
  }
  return sortBoatsByGlobalOrder(boats, globalOrder);
}

export function filterCalendarReservations(
  reservations: Reservation[],
  hiddenStatuses: Set<ReservationStatus>,
): Reservation[] {
  if (hiddenStatuses.size === 0) return reservations;
  return reservations.filter((r) => {
    const status = resolveReservationStatus(r.details);
    if (hiddenStatuses.has(status)) return false;
    if (hiddenStatuses.has('cancelled') && isReservationCancelled(r.details)) return false;
    return true;
  });
}

export function calendarStatusFilterOptions(): typeof RESERVATION_STATUSES {
  return RESERVATION_STATUSES;
}
