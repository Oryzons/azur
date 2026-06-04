import { useEffect, useMemo, useState } from 'react';
import { addDays, overlaps, startOfDay } from '@/pages/calendar/calendarConstants';
import { MarineWeatherSummary } from '@/pages/dashboard/MarineWeatherSummary';
import { DashboardDayRentals } from '@/components/dashboard/DashboardDayRentals';
import { DashboardFinanceSnapshot } from '@/components/dashboard/DashboardFinanceSnapshot';
import { DashboardMembersSnapshot } from '@/components/dashboard/DashboardMembersSnapshot';
import { DashboardCheckFlowSnapshot } from '@/components/dashboard/DashboardCheckFlowSnapshot';
import {
  dayToIso,
  resolveDashboardFocusDay,
  formatDashboardDayTitle,
  type DashboardDayView,
} from '@/lib/dashboardDay';
import { deserializeReservation, seedDemoReservationsIfEmpty, useReservationsStore } from '@/stores/reservations';
import { useBoatsStore } from '@/stores/boats';
import { useMembersStore } from '@/stores/members';
import { useCheckFlowStore, type TabletReservationRow } from '@/stores/checkFlow';
import { useUnavailabilitiesStore } from '@/stores/unavailabilities';
import { ContentReveal } from '@/components/ui/ContentReveal';
import { DashboardHomeSkeleton } from '@/components/skeletons/DashboardHomeSkeleton';
import { useCoreStoresReady } from '@/lib/useStoreHydration';

export function HomePage() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [dayView, setDayView] = useState<DashboardDayView>('today');
  const focusDay = useMemo(() => resolveDashboardFocusDay(dayView, today), [dayView, today]);
  const focusIso = useMemo(() => dayToIso(focusDay), [focusDay]);

  const rawItems = useReservationsStore((s) => s.items);
  const reservations = useMemo(() => rawItems.map(deserializeReservation), [rawItems]);
  const reservationsHydrated = useReservationsStore((s) => s.hydrated);
  const refreshReservations = useReservationsStore((s) => s.refresh);

  const storeBoats = useBoatsStore((s) => s.boats);
  const membersHydrated = useMembersStore((s) => s.hydrated);
  const refreshMembers = useMembersStore((s) => s.refresh);
  const fetchTablet = useCheckFlowStore((s) => s.fetchTabletReservations);

  const coreReady = useCoreStoresReady();

  const [tabletRows, setTabletRows] = useState<TabletReservationRow[]>([]);
  const [tabletLoading, setTabletLoading] = useState(true);

  useEffect(() => {
    if (!reservationsHydrated) void refreshReservations();
    seedDemoReservationsIfEmpty();
  }, [reservationsHydrated, refreshReservations]);

  useEffect(() => {
    if (!membersHydrated) void refreshMembers();
  }, [membersHydrated, refreshMembers]);

  useEffect(() => {
    let cancelled = false;
    setTabletLoading(true);
    void fetchTablet(focusIso)
      .then((data) => {
        if (!cancelled) setTabletRows(data);
      })
      .catch(() => {
        if (!cancelled) setTabletRows([]);
      })
      .finally(() => {
        if (!cancelled) setTabletLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [focusIso, fetchTablet]);

  const dayBounds = useMemo(
    () => ({ start: focusDay, end: addDays(focusDay, 1) }),
    [focusDay],
  );

  const resForDay = useMemo(
    () => reservations.filter((r) => overlaps(r.start, r.end, dayBounds.start, dayBounds.end)),
    [reservations, dayBounds],
  );

  const unavailItems = useUnavailabilitiesStore((s) => s.items);
  const unavailHydrated = useUnavailabilitiesStore((s) => s.hydrated);
  const refreshUnavail = useUnavailabilitiesStore((s) => s.refresh);

  useEffect(() => {
    if (!unavailHydrated) void refreshUnavail();
  }, [unavailHydrated, refreshUnavail]);

  const unavailForDay = useMemo(
    () =>
      unavailItems
        .filter((u) => {
          const start = new Date(u.startAt);
          const end = new Date(u.endAt);
          return overlaps(start, end, dayBounds.start, dayBounds.end);
        })
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [unavailItems, dayBounds],
  );

  const boatsById = useMemo(() => {
    const m = new Map<string, { id: string; name: string; brand?: string }>();
    for (const b of storeBoats) m.set(b.id, { id: b.id, name: b.name, brand: b.brand });
    return m;
  }, [storeBoats]);

  const tabletByReservationId = useMemo(() => {
    const m = new Map<string, TabletReservationRow>();
    for (const row of tabletRows) m.set(row.id, row);
    return m;
  }, [tabletRows]);

  const dateTitle = today.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }, []);

  const checkDayLabel = formatDashboardDayTitle(focusDay, dayView);

  return (
    <ContentReveal ready={coreReady} skeleton={<DashboardHomeSkeleton />}>
      <div className="w-full space-y-8">
        <header className="space-y-1">
          <p className="text-sm font-medium text-[#416B9F]">{greeting}</p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Tableau de bord</h1>
          <p className="capitalize text-[15px] text-zinc-600">{dateTitle}</p>
        </header>

        <DashboardDayRentals
          dayView={dayView}
          onDayViewChange={setDayView}
          focusDay={focusDay}
          reservations={resForDay}
          unavailabilities={unavailForDay}
          boatsById={boatsById}
          tabletByReservationId={tabletByReservationId}
        />

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <MarineWeatherSummary />
          <DashboardFinanceSnapshot />
          <DashboardMembersSnapshot dayReservations={resForDay} />
          <DashboardCheckFlowSnapshot dayLabel={checkDayLabel} rows={tabletRows} loading={tabletLoading} />
        </div>
      </div>
    </ContentReveal>
  );
}
