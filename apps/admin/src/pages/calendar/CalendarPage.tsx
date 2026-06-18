import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import {
  assignLanes,
  BOAT_COL_W,
  clamp,
  DAY_COL_W,
  endOfMonth,
  endOfWeekSunday,
  isSameDay,
  monthTitle,
  overlaps,
  pad2,
  planningRowMetrics,
  PILL_LANE_GAP,
  PRIMARY,
  CALENDAR_BOAT_ROW_DRAG_MIME,
  segmentLabel,
  ownerSegmentLabel,
  startOfDay,
  dayToIso,
  addDays,
  startOfMonth,
  startOfWeekMonday,
  uid,
  type ViewMode,
} from '@/pages/calendar/calendarConstants';
import { DayPlanning } from '@/pages/calendar/DayPlanning';
import { ReservationPill } from '@/pages/calendar/ReservationPill';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import {
  ReservationCreateWizard,
  type ReservationWizardSubmitPayload,
} from '@/pages/calendar/ReservationCreateWizard';
import { emptyWizardDetails } from '@/pages/calendar/reservationWizardTypes';
import { usePresence } from '@/lib/presence';
import { deserializeReservation, seedDemoReservationsIfEmpty, useReservationsStore } from '@/stores/reservations';
import { useBoatsStore } from '@/stores/boats';
import { ReservationDetailsPanel } from '@/pages/reservations/ReservationDetailsPanel';
import { CalendarFiltersPanel } from '@/components/calendar/CalendarFiltersPanel';
import { usePageFiltersPanel, type PageFiltersConfig } from '@/contexts/PageFiltersContext';
import {
  applyCalendarBoatVisibility,
  countCalendarActiveFilters,
  createCalendarFilterState,
  deserializeCalendarFilters,
  filterCalendarBoats,
  filterCalendarReservations,
  serializeCalendarFilters,
  sortCalendarBoats,
  type CalendarFilterState,
} from '@/lib/calendarFilters';
import { usePersistedPageFilters } from '@/lib/pageFilterStorage';
import {
  applySubsetReorder,
  loadCalendarBoatOrder,
  moveIndexInArray,
  normalizeBoatOrder,
  saveCalendarBoatOrder,
} from '@/lib/calendarBoatOrder';
import { useMembersStore } from '@/stores/members';
import { coverPhotoUrl } from '@/lib/mediaPhotos';
import { isReservationLockedFromReservation } from '@/lib/reservationLock';
import { ContentReveal } from '@/components/ui/ContentReveal';
import { CalendarPageSkeleton, CalendarPlanningSkeleton } from '@/components/skeletons/PageSkeletons';
import { useCoreStoresReady } from '@/lib/useStoreHydration';
import { BoatCoverAvatar } from '@/components/media/BoatCoverAvatar';
import { buildCalendarPillLegend } from '@/lib/calendarPillLegend';
import { CALENDAR_STATUS_LEGEND, type ReservationStatus } from '@/lib/reservationStatus';
import { useExtrasStore } from '@/stores/extras';
import { useAuthStore } from '@/stores/auth';
import { isOwnerUser } from '@/lib/userRoles';
import { useOwnerFleetScope } from '@/lib/ownerFleetScope';
import { useUnavailabilitiesStore, type BoatUnavailability } from '@/stores/unavailabilities';
import { UnavailabilityModal } from '@/components/calendar/UnavailabilityModal';
import { UnavailabilityPill } from '@/components/calendar/UnavailabilityPill';
import { unavailabilitiesForBoatPeriod } from '@/lib/planningUnavailability';
import { extractApiErrorMessage } from '@/lib/apiError';

type Boat = {
  id: string;
  name: string;
  meta?: string;
  fleetId?: string | null;
  coverPhotoUrl?: string | null;
};

export function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const userRole = useAuthStore((s) => s.user.role);
  const isOwner = isOwnerUser(userRole);
  const { scopedBoats: catalogBoats, ownedBoatIdSet } = useOwnerFleetScope();
  const unavailItemsRaw = useUnavailabilitiesStore((s) => s.items);
  const unavailItems = useMemo(
    () => (isOwner ? unavailItemsRaw.filter((u) => ownedBoatIdSet.has(u.boatId)) : unavailItemsRaw),
    [isOwner, unavailItemsRaw, ownedBoatIdSet],
  );
  const refreshUnavail = useUnavailabilitiesStore((s) => s.refresh);
  const createUnavail = useUnavailabilitiesStore((s) => s.create);
  const updateUnavail = useUnavailabilitiesStore((s) => s.update);
  const removeUnavail = useUnavailabilitiesStore((s) => s.remove);
  const [unavailModalOpen, setUnavailModalOpen] = useState(false);
  const [editingUnavail, setEditingUnavail] = useState<BoatUnavailability | null>(null);
  const [unavailInitialBoatId, setUnavailInitialBoatId] = useState<string | undefined>();
  const [unavailInitialDay, setUnavailInitialDay] = useState<Date | undefined>();
  const [unavailInitialTimes, setUnavailInitialTimes] = useState<
    Readonly<{ startTime: string; endTime: string }> | undefined
  >();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsReservationId, setDetailsReservationId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createWizardNonce, setCreateWizardNonce] = useState(0);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [createInitial, setCreateInitial] = useState<{
    boatId: string;
    dateIso: string;
    initialStartTime?: string;
    initialEndTime?: string;
  }>({ boatId: '', dateIso: '' });
  const [createInitialDetails, setCreateInitialDetails] = useState(() => emptyWizardDetails());
  const [filters, setFilters] = usePersistedPageFilters(
    'calendar',
    createCalendarFilterState(),
    serializeCalendarFilters,
    deserializeCalendarFilters,
  );
  const [boatGlobalOrder, setBoatGlobalOrder] = useState<string[]>([]);

  const detailsPresence = usePresence(detailsOpen, 180);
  const createPresence = usePresence(createOpen, 180);

  const ownerModalBoats = useMemo(
    () => catalogBoats.map((b) => ({ id: b.id, name: b.name })),
    [catalogBoats],
  );

  const fleets = useBoatsStore((s) => s.fleets);
  const boatsHydrated = useBoatsStore((s) => s.hydrated);
  const members = useMembersStore((s) => s.members);
  const extrasCatalog = useExtrasStore((s) => s.extras);
  const pillLegend = useMemo(() => buildCalendarPillLegend(extrasCatalog), [extrasCatalog]);

  function patchFilter<K extends keyof CalendarFilterState>(key: K, value: CalendarFilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetCalendarFilters() {
    setFilters(createCalendarFilterState());
  }

  const boats = useMemo<Boat[]>(() => {
    if (!boatsHydrated) return [];
    return catalogBoats.map((b) => ({
      id: b.id,
      name: b.name,
      meta: `${b.brand} · ${b.model}`,
      fleetId: b.fleetId ?? null,
      coverPhotoUrl: coverPhotoUrl(b.presentationPhotos ?? []),
    }));
  }, [catalogBoats, boatsHydrated]);

  const matchingBoats = useMemo(
    () => filterCalendarBoats(boats, catalogBoats, filters),
    [boats, catalogBoats, filters],
  );

  const catalogIds = useMemo(() => boats.map((b) => b.id), [boats]);

  const ownersForFilter = useMemo(
    () =>
      members
        .filter((m) => m.role === 'proprietaire')
        .map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}`.trim() || m.email }))
        .sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    [members],
  );

  useEffect(() => {
    setBoatGlobalOrder((prev) => {
      if (prev.length === 0) {
        return normalizeBoatOrder(loadCalendarBoatOrder(), catalogIds);
      }
      return normalizeBoatOrder(prev, catalogIds);
    });
  }, [catalogIds]);

  const rawItems = useReservationsStore((s) => s.items);
  const reservations = useMemo(() => {
    const all = rawItems.map(deserializeReservation);
    if (!isOwner) return all;
    return all.filter((r) => ownedBoatIdSet.has(r.boatId));
  }, [rawItems, isOwner, ownedBoatIdSet]);
  const setReservations = useReservationsStore((s) => s.replace);
  const reservationsHydrated = useReservationsStore((s) => s.hydrated);
  const refreshReservations = useReservationsStore((s) => s.refresh);
  const coreReady = useCoreStoresReady();

  const highlightDay = useMemo(() => {
    if (!unavailModalOpen) return undefined;
    if (editingUnavail) return startOfDay(new Date(editingUnavail.startAt));
    return unavailInitialDay;
  }, [unavailModalOpen, editingUnavail, unavailInitialDay]);

  useEffect(() => {
    if (!reservationsHydrated) void refreshReservations();
    seedDemoReservationsIfEmpty();
  }, [reservationsHydrated, refreshReservations]);

  useEffect(() => {
    void refreshUnavail();
  }, [refreshUnavail]);

  useEffect(() => {
    const id = searchParams.get('unavail');
    if (!id || !unavailItems.length) return;
    const row = unavailItems.find((u) => u.id === id);
    if (row) {
      setEditingUnavail(row);
      setUnavailModalOpen(true);
    }
  }, [searchParams, unavailItems]);

  function openUnavailabilityModal(
    boatId?: string,
    day?: Date,
    times?: Readonly<{ startTime: string; endTime: string }>,
  ) {
    setEditingUnavail(null);
    setUnavailInitialBoatId(boatId);
    setUnavailInitialDay(day ? startOfDay(day) : undefined);
    setUnavailInitialTimes(times);
    setUnavailModalOpen(true);
  }

  function handleGridCreate(boatId: string, day: Date, times?: Readonly<{ startTime: string; endTime: string }>) {
    if (isOwner) {
      openUnavailabilityModal(boatId, day, times);
      return;
    }
    openCreate(boatId, day, times);
  }

  const period = useMemo(() => {
    if (view === 'month') {
      const monthStart = startOfMonth(cursor);
      const monthEnd = endOfMonth(cursor);
      const gridStart = startOfWeekMonday(monthStart);
      const gridEndInclusive = endOfWeekSunday(monthEnd);
      const gridDays = Math.round((gridEndInclusive.getTime() - gridStart.getTime()) / 86400000) + 1;
      const days = Array.from({ length: gridDays }, (_, i) => addDays(gridStart, i));
      const end = addDays(gridEndInclusive, 1);
      return { start: gridStart, end, days, cols: days.length, title: monthTitle(cursor), month: cursor.getMonth() };
    }
    if (view === 'week') {
      const start = startOfWeekMonday(cursor);
      const end = addDays(start, 7);
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      const first = days[0] ?? start;
      const last = days[6] ?? addDays(start, 6);
      const title = `${first.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} — ${last.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      return { start, end, days, cols: 7, title, month: cursor.getMonth() };
    }
    const start = startOfDay(cursor);
    const end = addDays(start, 1);
    const title = start.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    return { start, end, days: [start], cols: 1, title, month: cursor.getMonth() };
  }, [cursor, view]);

  const calendarReservations = useMemo(() => {
    const hiddenStatuses = isOwner
      ? new Set<ReservationStatus>([...filters.hiddenStatuses, 'cancelled'])
      : filters.hiddenStatuses;
    return filterCalendarReservations(reservations, hiddenStatuses);
  }, [reservations, filters.hiddenStatuses, isOwner]);

  const visibleBoats = useMemo(
    () => applyCalendarBoatVisibility(matchingBoats, filters, calendarReservations, period),
    [matchingBoats, filters, calendarReservations, period],
  );

  const orderedFilteredBoats = useMemo(() => {
    const order = boatGlobalOrder.length > 0 ? boatGlobalOrder : normalizeBoatOrder(null, catalogIds);
    return sortCalendarBoats(visibleBoats, filters.sortMode, order, fleets, catalogBoats.length > 0);
  }, [boatGlobalOrder, catalogIds, visibleBoats, filters.sortMode, fleets, catalogBoats.length]);

  function reorderCalendarBoats(fromIndex: number, toIndex: number) {
    const vis = orderedFilteredBoats.map((b) => b.id);
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= vis.length || toIndex >= vis.length) return;
    const newVis = moveIndexInArray(vis, fromIndex, toIndex);
    setBoatGlobalOrder((g) => {
      const next = applySubsetReorder(g.length ? g : normalizeBoatOrder(null, catalogIds), newVis);
      saveCalendarBoatOrder(next);
      return next;
    });
    if (filters.sortMode !== 'custom') {
      patchFilter('sortMode', 'custom');
    }
  }

  const filtersActiveCount = countCalendarActiveFilters(filters);

  const calendarFiltersPanel = useMemo(
    () =>
      isOwner ? null : (
        <CalendarFiltersPanel
          fleets={fleets}
          storeBoats={catalogBoats}
          owners={ownersForFilter}
          orderedBoats={orderedFilteredBoats}
          allMatchingBoats={matchingBoats}
          filterState={filters}
          onFilterChange={patchFilter}
          onReorderBoats={reorderCalendarBoats}
          onReset={resetCalendarFilters}
        />
      ),
    [isOwner, fleets, catalogBoats, ownersForFilter, orderedFilteredBoats, matchingBoats, filters],
  );

  function openReservation(id: string) {
    setDetailsReservationId(id);
    setDetailsOpen(true);
    if (searchParams.get('open') === id) {
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      setSearchParams(next, { replace: true });
    }
  }

  function closeReservation() {
    setDetailsOpen(false);
    setDetailsReservationId(null);
  }

  useEffect(() => {
    const v = searchParams.get('view');
    const date = searchParams.get('date');
    const openId = searchParams.get('open');
    const editId = searchParams.get('edit');
    if (v === 'day' || v === 'week' || v === 'month') setView(v);
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setCursor(new Date(`${date}T12:00:00.000`));
    }
    if (openId && reservations.some((r) => r.id === openId)) {
      openReservation(openId);
    }
    if (editId && !isOwner && reservations.some((r) => r.id === editId)) {
      openEdit(editId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, searchParams]);

  function openCreate(
    boatId: string,
    day: Date,
    times?: Readonly<{ startTime: string; endTime: string }>,
  ) {
    const d = startOfDay(day);
    setEditingReservationId(null);
    setCreateInitial({
      boatId,
      dateIso: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
      ...(times ? { initialStartTime: times.startTime, initialEndTime: times.endTime } : {}),
    });
    setCreateInitialDetails(emptyWizardDetails());
    setCreateWizardNonce((n) => n + 1);
    setCreateOpen(true);
  }

  function openEdit(id: string) {
    const r = reservations.find((x) => x.id === id);
    if (!r) return;
    if (isReservationLockedFromReservation(r)) {
      openReservation(id);
      return;
    }
    setEditingReservationId(id);
    const day = startOfDay(r.start);
    const dateIso = `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`;
    const toHHmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    setCreateInitial({
      boatId: r.boatId,
      dateIso,
      initialStartTime: toHHmm(r.start),
      initialEndTime: toHHmm(r.end),
    });
    setCreateInitialDetails(r.details ?? emptyWizardDetails());
    setCreateWizardNonce((n) => n + 1);
    setCreateOpen(true);
    if (searchParams.get('edit') === id) {
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  }

  function closeCreate() {
    setCreateOpen(false);
  }

  function handleWizardSubmit(payload: ReservationWizardSubmitPayload) {
    const { boatId, dateIso, startTime, endTime, bookerName, details, totalDueCents } = payload;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const day = new Date(`${dateIso}T00:00:00.000`);
    const start = new Date(day);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(day);
    end.setHours(eh, em, 0, 0);
    if (editingReservationId) {
      const existing = reservations.find((x) => x.id === editingReservationId);
      if (existing && isReservationLockedFromReservation(existing)) {
        setCreateOpen(false);
        openReservation(editingReservationId);
        return;
      }
      setReservations((prev) => {
        const existing = prev.find((x) => x.id === editingReservationId);
        if (!existing) return prev;
        if (isReservationLockedFromReservation(existing)) return prev;
        return prev.map((x) =>
          x.id === editingReservationId
            ? {
                ...x,
                boatId,
                title: bookerName,
                start,
                end,
                color: x.color ?? PRIMARY,
                details,
                totalDueCents,
              }
            : x,
        );
      });
    } else {
      const id = uid('resa');
      const newRes: Reservation = {
        id,
        boatId,
        title: bookerName,
        start,
        end,
        color: PRIMARY,
        details,
        totalDueCents,
      };
      setReservations((prev) => [...prev, newRes]);
    }

    setCreateOpen(false);
  }

  function goPrev() {
    if (view === 'month') setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else if (view === 'week') setCursor((d) => addDays(d, -7));
    else setCursor((d) => addDays(d, -1));
  }

  function goNext() {
    if (view === 'month') setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else if (view === 'week') setCursor((d) => addDays(d, 7));
    else setCursor((d) => addDays(d, 1));
  }

  function goToday() {
    setCursor(new Date());
  }

  const calendarFiltersConfig = useMemo(
    () =>
      isOwner
        ? null
        : ({
            title: 'Calendrier',
            subtitle: 'Tri des bateaux, visibilité, flotilles et statuts des créneaux.',
            activeFilterCount: filtersActiveCount,
            panelBody: calendarFiltersPanel,
          } as PageFiltersConfig),
    [isOwner, filtersActiveCount, calendarFiltersPanel],
  );

  usePageFiltersPanel(calendarFiltersConfig);

  let planningBody: ReactNode;
  if (!boatsHydrated) {
    planningBody = <CalendarPlanningSkeleton rows={6} />;
  } else if (orderedFilteredBoats.length === 0) {
    planningBody = (
      <div className="py-10 text-center">
        <p className="text-sm font-medium text-zinc-800">Aucun bateau disponible</p>
        <p className="mt-2 text-sm text-zinc-500">
          {isOwner
            ? 'Aucun bateau ne vous est attribué pour le moment. Contactez Bleu Calanque.'
            : 'Ajoute des bateaux pour créer des réservations liées à la base de données.'}
        </p>
        {!isOwner ? (
          <Link
            to="/bateaux"
            className="mt-4 inline-flex rounded-2xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
          >
            Gérer les bateaux
          </Link>
        ) : null}
      </div>
    );
  } else if (view === 'day') {
    planningBody = (
      <DayPlanning
        boats={orderedFilteredBoats}
        reservations={calendarReservations}
        day={period.start}
        onMove={setReservations}
        onCreate={handleGridCreate}
        readOnly={isOwner}
        ownerMinimal={isOwner}
        onOpenReservation={openReservation}
        onReorderBoatRows={isOwner ? undefined : reorderCalendarBoats}
        unavailabilities={unavailItems}
        onOpenUnavailability={(u) => {
          setEditingUnavail(u);
          setUnavailInitialDay(startOfDay(new Date(u.startAt)));
          setUnavailModalOpen(true);
        }}
        highlightDay={highlightDay}
      />
    );
  } else {
    planningBody = (
      <SpanPlanning
        mode={view}
        boats={orderedFilteredBoats}
        reservations={calendarReservations}
        unavailabilities={unavailItems}
        start={period.start}
        end={period.end}
        days={period.days}
        monthIndex={period.month}
        onMove={setReservations}
        onCreate={handleGridCreate}
        onOpenReservation={openReservation}
        onOpenUnavailability={(u) => {
          setEditingUnavail(u);
          setUnavailInitialDay(startOfDay(new Date(u.startAt)));
          setUnavailModalOpen(true);
        }}
        onReorderBoatRows={isOwner ? undefined : reorderCalendarBoats}
        readOnly={isOwner}
        ownerMinimal={isOwner}
        highlightDay={highlightDay}
      />
    );
  }

  return (
    <ContentReveal ready={coreReady} skeleton={<CalendarPageSkeleton />}>
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {isOwner ? 'Mon calendrier' : 'Calendrier'}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-500">
            {isOwner
              ? 'Planning de vos bateaux — réservations et indisponibilités.'
              : 'Planning des bateaux, réservations et indisponibilités.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {!isOwner && boatsHydrated && catalogBoats.length > 0 ? (
            <div className="flex gap-2 items-center px-3 py-2 bg-white rounded-2xl border shadow-sm border-zinc-200">
              <span className="text-sm font-semibold text-zinc-700">Flotille</span>
              <select
                value={filters.fleetId}
                onChange={(e) => patchFilter('fleetId', e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15"
              >
                <option value="">Toutes</option>
                {fleets.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex gap-2 items-center p-1 bg-white rounded-2xl border shadow-sm border-zinc-200">
            {([
              { k: 'month', label: 'Mois' },
              { k: 'week', label: 'Semaine' },
              { k: 'day', label: 'Jour' },
            ] as const).map((b) => {
              const active = view === b.k;
              return (
                <button
                  key={b.k}
                  type="button"
                  onClick={() => setView(b.k)}
                  className={[
                    'rounded-2xl px-4 py-2 text-sm font-semibold transition-colors',
                    active ? 'bg-[#416B9F] text-white shadow-sm shadow-[#416B9F]/20' : 'text-zinc-600 hover:bg-zinc-50',
                  ].join(' ')}
                >
                  {b.label}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 items-center p-1 bg-white rounded-2xl border shadow-sm border-zinc-200">
            <button
              type="button"
              onClick={goPrev}
              className="flex justify-center items-center w-10 h-10 rounded-2xl text-zinc-600 hover:bg-zinc-50"
              aria-label="Précédent"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="px-3 py-2 text-sm font-semibold rounded-2xl text-zinc-700 hover:bg-zinc-50"
            >
              Aujourd’hui
            </button>
            <button
              type="button"
              onClick={goNext}
              className="flex justify-center items-center w-10 h-10 rounded-2xl text-zinc-600 hover:bg-zinc-50"
              aria-label="Suivant"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <section
        className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-200/40"
        data-tour={isOwner ? 'owner-calendar-planning' : 'admin-calendar-planning'}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-gradient-to-r from-zinc-50/90 to-white px-4 py-3 sm:px-5">
          <p className="text-base font-semibold capitalize text-zinc-900">{period.title}</p>
          <p
            className="text-xs text-zinc-400"
            data-tour={isOwner ? 'owner-calendar-unavail-hint' : undefined}
          >
            {isOwner
              ? 'Défilement horizontal · clic sur une date pour une indisponibilité'
              : 'Faites défiler horizontalement pour voir tout le mois'}
          </p>
        </div>

        <div className="p-1 sm:p-2">{planningBody}</div>
      </section>

      <ReservationDetailsPanel
        presence={detailsPresence}
        reservationId={detailsReservationId}
        reservations={reservations}
        boatsCatalog={catalogBoats}
        fleetsCatalog={fleets}
        ownerReadOnly={isOwner}
        onClose={closeReservation}
        onEdit={
          isOwner
            ? undefined
            : (id) => {
                closeReservation();
                openEdit(id);
              }
        }
        onOpenReservation={openReservation}
      />

      <UnavailabilityModal
        key={
          editingUnavail?.id ??
          `new-${unavailInitialBoatId ?? ''}-${unavailInitialDay?.getTime() ?? 'today'}`
        }
        open={unavailModalOpen}
        boats={isOwner ? ownerModalBoats : orderedFilteredBoats.map((b) => ({ id: b.id, name: b.name }))}
        initial={editingUnavail}
        initialBoatId={unavailInitialBoatId}
        initialDay={unavailInitialDay}
        initialTimes={unavailInitialTimes}
        onClose={() => {
          setUnavailModalOpen(false);
          setEditingUnavail(null);
          setUnavailInitialBoatId(undefined);
          setUnavailInitialDay(undefined);
          setUnavailInitialTimes(undefined);
        }}
        onSave={async (input, existingId) => {
          try {
            const saved = existingId ? await updateUnavail(existingId, input) : await createUnavail(input);
            setCursor(startOfDay(new Date(saved.startAt)));
          } catch (e) {
            throw new Error(extractApiErrorMessage(e, 'Enregistrement impossible.'));
          }
        }}
        onDelete={
          editingUnavail
            ? async (id) => {
                await removeUnavail(id);
              }
            : undefined
        }
      />

      {!isOwner && createPresence.present ? (
        <ReservationCreateWizard
          key={`resa-wizard-${createWizardNonce}`}
          presence={createPresence}
          onClose={closeCreate}
          lockCatalogPricing={Boolean(editingReservationId)}
          excludeReservationId={editingReservationId ?? undefined}
          boats={orderedFilteredBoats.map((b) => ({ id: b.id, name: b.name }))}
          initialBoatId={createInitial.boatId}
          initialDateIso={createInitial.dateIso}
          initialStartTime={createInitial.initialStartTime}
          initialEndTime={createInitial.initialEndTime}
          initialDetails={createInitialDetails}
          titleLabel={editingReservationId ? 'Modifier la réservation' : 'Nouvelle réservation'}
          submitLabel={editingReservationId ? 'Enregistrer' : 'Créer la réservation'}
          onAddUnavailability={({ boatId, dateIso, startTime, endTime }) => {
            // Remplace le wizard réservation par la modale indisponibilité (évite le chevauchement).
            closeCreate();
            openUnavailabilityModal(boatId, new Date(`${dateIso}T00:00:00`), { startTime, endTime });
          }}
          onSubmit={handleWizardSubmit}
        />
      ) : null}

      <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm shadow-zinc-200/40">
        <h2 className="text-sm font-semibold text-zinc-800">Légende</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {isOwner
            ? 'Gris = vos indisponibilités · bleu ardoise = créneaux réservés (horaires uniquement).'
            : 'Couleur des blocs selon le statut (orange = payée partiellement, ex. hors ligne restant).'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm bg-zinc-500" aria-hidden />
            Indisponibilité
          </div>
          {isOwner ? (
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm">
              <span className="h-3 w-3 shrink-0 rounded-sm bg-slate-500" aria-hidden />
              Location client
            </div>
          ) : (
            CALENDAR_STATUS_LEGEND.map(({ label, color }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm"
              >
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: color }} aria-hidden />
                {label}
              </div>
            ))
          )}
        </div>
        {!isOwner ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {pillLegend.map(({ key, label, color, Icon }) => (
              <div
                key={key}
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm"
                  style={{ background: color }}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="font-medium">{label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
    </ContentReveal>
  );
}

function SpanPlanning(props: Readonly<{
  mode: 'month' | 'week';
  boats: Boat[];
  reservations: Reservation[];
  unavailabilities: BoatUnavailability[];
  start: Date;
  end: Date;
  days: Date[];
  monthIndex: number;
  onMove: React.Dispatch<React.SetStateAction<Reservation[]>>;
  onCreate: (boatId: string, day: Date) => void;
  onOpenReservation: (id: string) => void;
  onOpenUnavailability: (item: BoatUnavailability) => void;
  onReorderBoatRows?: (fromIndex: number, toIndex: number) => void;
  readOnly?: boolean;
  ownerMinimal?: boolean;
  highlightDay?: Date;
}>) {
  const {
    boats,
    reservations,
    unavailabilities,
    start,
    end,
    days,
    mode,
    monthIndex,
    onMove,
    onCreate,
    onOpenReservation,
    onOpenUnavailability,
    onReorderBoatRows,
    readOnly,
    ownerMinimal = false,
    highlightDay,
  } = props;
  const ro = Boolean(readOnly);
  const ownerView = ownerMinimal;
  const boatColBg = ownerView ? 'bg-white' : 'bg-zinc-50';
  const boatRowColBg = ownerView ? 'bg-white group-hover:bg-zinc-50' : 'bg-white group-hover:bg-zinc-50/80';
  const today = startOfDay(new Date());
  const isWeek = mode === 'week';
  const gridCols = isWeek
    ? `repeat(${days.length}, minmax(0, 1fr))`
    : `repeat(${days.length}, ${DAY_COL_W}px)`;

  function updateReservation(id: string, patch: Partial<Reservation>) {
    const target = reservations.find((r) => r.id === id);
    if (target && isReservationLockedFromReservation(target)) return;
    onMove((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const openReservation = (id: string) => onOpenReservation(id);

  function dayCellTone(d: Date) {
    const inMonth = d.getMonth() === monthIndex;
    const isToday = startOfDay(d).getTime() === today.getTime();
    const isSelected = highlightDay ? isSameDay(d, highlightDay) : false;
    const weekend = (d.getDay() + 6) % 7 >= 5;
    if (isSelected) return 'bg-[#416B9F]/14 ring-1 ring-inset ring-[#416B9F]/35';
    if (isToday) return 'bg-[#416B9F]/8 ring-1 ring-inset ring-[#416B9F]/20';
    if (!inMonth) return 'bg-zinc-50/60';
    if (weekend) return 'bg-zinc-50/90';
    return 'bg-white';
  }

  function dayHeaderTone(d: Date) {
    const inMonth = d.getMonth() === monthIndex;
    const isToday = startOfDay(d).getTime() === today.getTime();
    const isSelected = highlightDay ? isSameDay(d, highlightDay) : false;
    if (isSelected) return 'bg-[#416B9F]/12 text-[#416B9F]';
    if (isToday) return 'bg-[#416B9F]/10 text-[#416B9F]';
    if (!inMonth) return 'text-zinc-300';
    return 'text-zinc-600';
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white">
      <div className={isWeek ? 'overflow-hidden' : 'overflow-x-auto overflow-y-hidden scroll-smooth'}>
        <div style={{ minWidth: isWeek ? '100%' : BOAT_COL_W + days.length * DAY_COL_W }}>
          <div
            className={[
              'flex sticky top-0 z-30 border-b border-zinc-100',
              ownerView ? 'bg-white' : 'bg-zinc-50/95 backdrop-blur-sm',
            ].join(' ')}
          >
            <div
              className={[
                'sticky left-0 z-20 shrink-0 border-r border-zinc-100 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.06)]',
                boatColBg,
              ].join(' ')}
              style={{ width: BOAT_COL_W }}
            >
              <div className="flex h-[52px] items-center px-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Bateaux
              </div>
            </div>
            <div className="flex-1">
              <div className="grid" style={{ gridTemplateColumns: gridCols }}>
                {days.map((d) => {
                  const inMonth = d.getMonth() === monthIndex;
                  const isToday = startOfDay(d).getTime() === today.getTime();
                  const wd = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'][(d.getDay() + 6) % 7];
                  return (
                    <div
                      key={d.toISOString()}
                      className={[
                        'flex h-[52px] flex-col items-center justify-center gap-0.5 border-l border-zinc-100/80',
                        dayHeaderTone(d),
                      ].join(' ')}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{wd}</span>
                      <span
                        className={[
                          'flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold',
                          isToday && inMonth ? 'bg-[#416B9F] text-white shadow-sm' : '',
                          !isToday && inMonth ? 'text-inherit' : '',
                          !inMonth ? 'text-zinc-300' : '',
                        ].join(' ')}
                      >
                        {d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="divide-y divide-zinc-100">
            {boats.map((boat, rowIndex) => {
              const rowRes = reservations.filter((r) => r.boatId === boat.id && overlaps(r.start, r.end, start, end));
              const rowUnavail = unavailabilitiesForBoatPeriod(unavailabilities, boat.id, start, end);

              // Lane assignment by day-index overlap (month/week)
              const segs = rowRes
                .map((r) => {
                  const startIdx = clamp(
                    Math.floor((startOfDay(r.start).getTime() - start.getTime()) / 86400000),
                    0,
                    days.length - 1,
                  );
                  const effectiveEnd = new Date(r.end.getTime() - 1);
                  const endIdx = clamp(
                    Math.floor((startOfDay(effectiveEnd).getTime() - start.getTime()) / 86400000),
                    0,
                    days.length - 1,
                  );
                  return { r, startIdx, endIdx };
                })
                .sort((a, b) => a.startIdx - b.startIdx || a.endIdx - b.endIdx);

              const overlayPad = 2;

              const unavailSegs = rowUnavail
                .map((u) => {
                  const uStart = new Date(u.startAt);
                  const uEnd = new Date(u.endAt);
                  const startIdx = clamp(
                    Math.floor((startOfDay(uStart).getTime() - start.getTime()) / 86400000),
                    0,
                    days.length - 1,
                  );
                  const effectiveEnd = new Date(uEnd.getTime() - 1);
                  const endIdx = clamp(
                    Math.floor((startOfDay(effectiveEnd).getTime() - start.getTime()) / 86400000),
                    0,
                    days.length - 1,
                  );
                  return { u, startIdx, endIdx };
                })
                .sort((a, b) => a.startIdx - b.startIdx || a.endIdx - b.endIdx);

              type RowSeg =
                | { kind: 'reservation'; id: string; startIdx: number; endIdx: number; r: Reservation }
                | { kind: 'unavailability'; id: string; startIdx: number; endIdx: number; u: BoatUnavailability };

              const rowSegs: RowSeg[] = [
                ...segs.map((s) => ({
                  kind: 'reservation' as const,
                  id: s.r.id,
                  startIdx: s.startIdx,
                  endIdx: s.endIdx,
                  r: s.r,
                })),
                ...unavailSegs.map((s) => ({
                  kind: 'unavailability' as const,
                  id: s.u.id,
                  startIdx: s.startIdx,
                  endIdx: s.endIdx,
                  u: s.u,
                })),
              ].sort((a, b) => a.startIdx - b.startIdx || a.endIdx - b.endIdx);

              const laneInfo = assignLanes(
                rowSegs,
                (s) => s.startIdx,
                (s) => s.endIdx + 1,
              );
              // Hauteur "normale" basée sur 1 seul couloir.
              // On compactera uniquement les segments mono-jour quand ils sont plusieurs sur la même date.
              const { barH: baseBarH, rowHeight } = planningRowMetrics(1);

              const daySingleLaneInfo = new Map<number, { count: number; laneBySegIndex: Map<number, number> }>();
              for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
                const singles: { segIndex: number; lane: number }[] = [];
                for (let i = 0; i < rowSegs.length; i++) {
                  const seg = rowSegs[i];
                  if (!seg) continue;
                  if (seg.startIdx !== dayIdx || seg.endIdx !== dayIdx) continue; // mono-jour
                  singles.push({ segIndex: i, lane: laneInfo.laneByIndex[i] ?? 0 });
                }
                if (singles.length <= 1) continue;

                const uniqueLanes = [...new Set(singles.map((s) => s.lane))].sort((a, b) => a - b);
                const laneRemap = new Map<number, number>();
                uniqueLanes.forEach((l, idx) => laneRemap.set(l, idx));

                const laneBySegIndex = new Map<number, number>();
                for (const s of singles) {
                  laneBySegIndex.set(s.segIndex, laneRemap.get(s.lane) ?? 0);
                }
                daySingleLaneInfo.set(dayIdx, { count: uniqueLanes.length, laneBySegIndex });
              }

              return (
                <div key={boat.id} className="group flex transition-colors hover:bg-zinc-50/50">
                  <div
                    className={[
                      'sticky left-0 z-20 shrink-0 border-r border-zinc-100 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]',
                      boatRowColBg,
                    ].join(' ')}
                    style={{ width: BOAT_COL_W, height: rowHeight }}
                    onDragOver={
                      onReorderBoatRows
                        ? (e) => {
                            if (!e.dataTransfer.types.includes(CALENDAR_BOAT_ROW_DRAG_MIME)) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }
                        : undefined
                    }
                    onDrop={
                      onReorderBoatRows
                        ? (e) => {
                            const raw = e.dataTransfer.getData(CALENDAR_BOAT_ROW_DRAG_MIME);
                            if (raw === '') return;
                            const from = Number.parseInt(raw, 10);
                            if (Number.isNaN(from)) return;
                            e.preventDefault();
                            e.stopPropagation();
                            onReorderBoatRows(from, rowIndex);
                          }
                        : undefined
                    }
                  >
                    <div className="flex gap-2 items-center px-2 h-full sm:gap-3 sm:px-4">
                      {onReorderBoatRows ? (
                        <button
                          type="button"
                          draggable
                          title="Glisser-déposer pour réordonner les lignes"
                          aria-label="Réordonner cette ligne de bateau"
                          className="flex shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-lg border-0 bg-transparent p-0 py-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 active:cursor-grabbing"
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData(CALENDAR_BOAT_ROW_DRAG_MIME, String(rowIndex));
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                        >
                          <GripVertical className="h-5 w-5" strokeWidth={1.75} />
                        </button>
                      ) : null}
                      <BoatCoverAvatar url={boat.coverPhotoUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate text-zinc-900">{boat.name}</p>
                        {boat.meta ? <p className="text-xs truncate text-zinc-400">{boat.meta}</p> : null}
                      </div>
                    </div>
                  </div>

                  {/* Grid cell */}
                  <section
                    className="relative z-0 flex-1"
                    style={{ height: rowHeight }}
                    onDragOver={ro ? undefined : (e) => e.preventDefault()}
                    onDrop={
                      ro
                        ? undefined
                        : (e) => {
                      if (e.dataTransfer.types.includes(CALENDAR_BOAT_ROW_DRAG_MIME)) {
                        e.preventDefault();
                        return;
                      }
                      const id = e.dataTransfer.getData('text/reservationId');
                      if (!id) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const colW = isWeek ? rect.width / Math.max(days.length, 1) : DAY_COL_W;
                      const dayIndex = clamp(Math.floor(x / colW), 0, days.length - 1);
                      const newDay = days[dayIndex] ?? days[0] ?? start;

                      const dragged = reservations.find((r) => r.id === id);
                      if (!dragged) return;

                      // Conserver l'heure (si week) ou caler sur 09:00 par défaut (si month)
                      const baseStart = new Date(dragged.start);
                      const baseEnd = new Date(dragged.end);

                      const startH = mode === 'month' ? 9 : baseStart.getHours();
                      const startM = mode === 'month' ? 0 : baseStart.getMinutes();
                      const endH = mode === 'month' ? 17 : baseEnd.getHours();
                      const endM = mode === 'month' ? 0 : baseEnd.getMinutes();

                      const newStart = new Date(newDay);
                      newStart.setHours(startH, startM, 0, 0);
                      const newEnd = new Date(newDay);
                      newEnd.setHours(endH, endM, 0, 0);

                      updateReservation(id, { boatId: boat.id, start: newStart, end: newEnd });
                    }}
                    aria-label={`Planning ${boat.name}`}
                  >
                    <div className="absolute inset-0 z-0">
                      <div
                        className="grid h-full"
                        style={{ gridTemplateColumns: gridCols }}
                      >
                        {days.map((d) => (
                          <button
                            key={d.toISOString()}
                            type="button"
                            data-calendar-day={dayToIso(d)}
                            aria-label={d.toLocaleDateString('fr-FR', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                            })}
                            className={[
                              'h-full border-l border-zinc-100/90 text-left',
                              dayCellTone(d),
                            ].join(' ')}
                            onClick={() => onCreate(boat.id, d)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Réservations & indisponibilités (positionnement absolu par couloir) */}
                    <div
                      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
                      style={{ paddingTop: overlayPad, paddingBottom: overlayPad }}
                    >
                      <div className="relative h-full w-full">
                        {rowSegs.map((seg, i) => {
                          const isMultiDay = seg.endIdx > seg.startIdx;
                          const daySpan = seg.endIdx - seg.startIdx + 1;
                          const singleDay = !isMultiDay;
                          const compactMeta = singleDay ? daySingleLaneInfo.get(seg.startIdx) : undefined;
                          const compactCount = compactMeta?.count ?? 1;
                          const compactLane = compactMeta?.laneBySegIndex.get(i);
                          const compactBarH =
                            compactCount > 1
                              ? Math.max(
                                  14,
                                  Math.floor(
                                    (rowHeight - overlayPad * 2 - (compactCount - 1) * PILL_LANE_GAP) /
                                      compactCount,
                                  ),
                                )
                              : baseBarH;
                          const lane = compactLane ?? (laneInfo.laneByIndex[i] ?? 0);
                          const top = overlayPad + lane * (compactBarH + PILL_LANE_GAP);
                          const rounded = isMultiDay ? 'rounded-xl px-2' : 'rounded-lg px-1.5';
                          const textSize = isMultiDay
                            ? 'text-xs'
                            : compactCount > 1
                              ? 'text-[9px]'
                              : 'text-[10px]';
                          const segStyle: React.CSSProperties = isWeek
                            ? {
                                left: `${(seg.startIdx / days.length) * 100}%`,
                                width: `${(daySpan / days.length) * 100}%`,
                                top,
                                height: compactBarH,
                              }
                            : {
                                left: seg.startIdx * DAY_COL_W,
                                width: daySpan * DAY_COL_W,
                                top,
                                height: compactBarH,
                              };

                          return (
                            <div
                              key={`${seg.kind}-${seg.id}`}
                              className="absolute box-border min-w-0 px-px"
                              style={segStyle}
                            >
                              {seg.kind === 'reservation' ? (
                                <ReservationPill
                                  reservation={seg.r}
                                  label={ownerMinimal ? ownerSegmentLabel(seg.r, mode) : segmentLabel(seg.r, mode)}
                                  height={compactBarH}
                                  draggable={!ro && !isReservationLockedFromReservation(seg.r)}
                                  minimal={ownerMinimal}
                                  neutralStyle={ownerMinimal}
                                  onClick={openReservation.bind(null, seg.r.id)}
                                  className={[
                                    'pointer-events-auto flex h-full w-full min-w-0 text-left font-semibold text-white shadow-sm',
                                    rounded,
                                    textSize,
                                  ].join(' ')}
                                />
                              ) : (
                                <UnavailabilityPill
                                  item={seg.u}
                                  label={seg.u.title}
                                  height={compactBarH}
                                  onClick={() => onOpenUnavailability(seg.u)}
                                  className={[
                                    'pointer-events-auto flex h-full w-full min-w-0 items-center text-left font-semibold text-white shadow-sm',
                                    rounded,
                                    textSize,
                                  ].join(' ')}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ReservationDetailsPanel déplacé dans `pages/reservations/ReservationDetailsPanel.tsx`
