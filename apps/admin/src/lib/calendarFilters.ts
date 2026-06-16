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
import { BOAT_TYPES_UI, type Boat as StoreBoat, type BoatType } from '@/stores/boats';

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

const CALENDAR_SORT_MODES: readonly CalendarSortMode[] = ['custom', 'fleet', 'alpha'];

export function createCalendarFilterState(
  overrides?: Partial<{
    fleetId: string;
    boatType: '' | BoatType;
    boatId: string;
    ownerId: string;
    search: string;
    hiddenBoatIds: Iterable<string>;
    sortMode: CalendarSortMode;
    hiddenStatuses: Iterable<ReservationStatus>;
    onlyWithReservationsInPeriod: boolean;
  }>,
): CalendarFilterState {
  return {
    fleetId: overrides?.fleetId ?? DEFAULT_CALENDAR_FILTER_STATE.fleetId,
    boatType: overrides?.boatType ?? DEFAULT_CALENDAR_FILTER_STATE.boatType,
    boatId: overrides?.boatId ?? DEFAULT_CALENDAR_FILTER_STATE.boatId,
    ownerId: overrides?.ownerId ?? DEFAULT_CALENDAR_FILTER_STATE.ownerId,
    search: overrides?.search ?? DEFAULT_CALENDAR_FILTER_STATE.search,
    hiddenBoatIds: new Set(overrides?.hiddenBoatIds ?? []),
    sortMode: overrides?.sortMode ?? DEFAULT_CALENDAR_FILTER_STATE.sortMode,
    hiddenStatuses: new Set(overrides?.hiddenStatuses ?? DEFAULT_CALENDAR_FILTER_STATE.hiddenStatuses),
    onlyWithReservationsInPeriod:
      overrides?.onlyWithReservationsInPeriod ?? DEFAULT_CALENDAR_FILTER_STATE.onlyWithReservationsInPeriod,
  };
}

export function serializeCalendarFilters(state: CalendarFilterState) {
  return {
    fleetId: state.fleetId,
    boatType: state.boatType,
    boatId: state.boatId,
    ownerId: state.ownerId,
    search: state.search,
    hiddenBoatIds: [...state.hiddenBoatIds],
    sortMode: state.sortMode,
    hiddenStatuses: [...state.hiddenStatuses],
    onlyWithReservationsInPeriod: state.onlyWithReservationsInPeriod,
  };
}

export function deserializeCalendarFilters(raw: unknown): CalendarFilterState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const boatType =
    o.boatType === '' || (typeof o.boatType === 'string' && BOAT_TYPES_UI.some((t) => t.value === o.boatType))
      ? (o.boatType as '' | BoatType)
      : '';
  const sortMode =
    typeof o.sortMode === 'string' && CALENDAR_SORT_MODES.includes(o.sortMode as CalendarSortMode)
      ? (o.sortMode as CalendarSortMode)
      : DEFAULT_CALENDAR_FILTER_STATE.sortMode;
  const hiddenBoatIds = Array.isArray(o.hiddenBoatIds)
    ? o.hiddenBoatIds.filter((id): id is string => typeof id === 'string')
    : [];
  const allowedStatuses = new Set(RESERVATION_STATUSES.map((s) => s.value));
  const hiddenStatuses = Array.isArray(o.hiddenStatuses)
    ? o.hiddenStatuses.filter((s): s is ReservationStatus => typeof s === 'string' && allowedStatuses.has(s as ReservationStatus))
    : [...DEFAULT_CALENDAR_FILTER_STATE.hiddenStatuses];

  return createCalendarFilterState({
    fleetId: typeof o.fleetId === 'string' ? o.fleetId : '',
    boatType,
    boatId: typeof o.boatId === 'string' ? o.boatId : '',
    ownerId: typeof o.ownerId === 'string' ? o.ownerId : '',
    search: typeof o.search === 'string' ? o.search : '',
    hiddenBoatIds,
    sortMode,
    hiddenStatuses,
    onlyWithReservationsInPeriod: o.onlyWithReservationsInPeriod === true,
  });
}

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
