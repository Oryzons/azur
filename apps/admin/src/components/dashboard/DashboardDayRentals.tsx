import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  Calendar,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  LogIn,
  LogOut,
  Ship,
} from 'lucide-react';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import { reservationClientLabel, reservationStatusBadge } from '@/lib/reservationUi';
import { isReservationCancelled } from '@/lib/reservationStatus';
import type { DashboardDayView } from '@/lib/dashboardDay';
import { formatDashboardDayTitle } from '@/lib/dashboardDay';
import type { TabletReservationRow } from '@/stores/checkFlow';
import type { BoatUnavailability } from '@/stores/unavailabilities';

type BoatLookup = { id: string; name: string; brand?: string };

type Props = {
  dayView: DashboardDayView;
  onDayViewChange: (v: DashboardDayView) => void;
  focusDay: Date;
  reservations: Reservation[];
  unavailabilities: BoatUnavailability[];
  boatsById: Map<string, BoatLookup>;
  tabletByReservationId: Map<string, TabletReservationRow>;
};

const COMPACT_THRESHOLD = 4;
const SCROLL_THRESHOLD = 7;

function checkFlags(
  r: Reservation,
  tablet?: TabletReservationRow,
): { checkInDone: boolean; checkOutDone: boolean } {
  if (tablet) {
    const checkInDone = tablet.checkFlowSubmissions.some((s) => s.kind === 'CHECK_IN');
    const checkOutDone = tablet.checkFlowSubmissions.some((s) => s.kind === 'CHECK_OUT');
    return { checkInDone, checkOutDone };
  }
  return { checkInDone: Boolean(r.checkInDone), checkOutDone: Boolean(r.checkOutDone) };
}

function boatLabel(boatsById: Map<string, BoatLookup>, boatId: string, embedded?: { name: string; brand: string }) {
  const fromStore = boatsById.get(boatId);
  const name = embedded?.name ?? fromStore?.name;
  const brand = embedded?.brand ?? fromStore?.brand;
  if (!name) return 'Bateau inconnu';
  return `${brand ?? ''} ${name}`.trim();
}

function formatTimeRange(start: Date, end: Date) {
  const timeStart = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const timeEnd = end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return { timeStart, timeEnd };
}

export function DashboardDayRentals(props: Readonly<Props>) {
  const {
    dayView,
    onDayViewChange,
    focusDay,
    reservations,
    unavailabilities,
    boatsById,
    tabletByReservationId,
  } = props;

  const active = reservations
    .filter((r) => !isReservationCancelled(r.details))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const { pendingReservations, readyReservations } = useMemo(() => {
    const pending: Reservation[] = [];
    const ready: Reservation[] = [];
    for (const r of active) {
      const flags = checkFlags(r, tabletByReservationId.get(r.id));
      if (!flags.checkInDone || !flags.checkOutDone) pending.push(r);
      else ready.push(r);
    }
    return { pendingReservations: pending, readyReservations: ready };
  }, [active, tabletByReservationId]);

  const dayLabel = formatDashboardDayTitle(focusDay, dayView);
  const dateLine = focusDay.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const rentalCount = active.length;
  const unavailCount = unavailabilities.length;
  const hasItems = rentalCount > 0 || unavailCount > 0;
  const dense = rentalCount + unavailCount >= COMPACT_THRESHOLD;
  const pendingCount = pendingReservations.length;

  const [unavailOpen, setUnavailOpen] = useState(unavailCount <= 2);

  return (
    <section
      aria-labelledby="dashboard-rentals-title"
      className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-100 px-5 py-5 sm:px-6">
        <div>
          <h2 id="dashboard-rentals-title" className="text-xl font-semibold text-zinc-900">
            Locations — {dayLabel}
          </h2>
          <p className="mt-1 capitalize text-base text-zinc-500">{dateLine}</p>
          {hasItems ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {rentalCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-[#416B9F]/10 px-2.5 py-0.5 text-xs font-semibold text-[#416B9F]">
                  {rentalCount} location{rentalCount !== 1 ? 's' : ''}
                </span>
              ) : null}
              {pendingCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  {pendingCount} à traiter
                </span>
              ) : null}
              {unavailCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-zinc-200/80 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
                  {unavailCount} indispo.
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <fieldset className="inline-flex rounded-xl border border-zinc-200/90 bg-zinc-50 p-1">
            <legend className="sr-only">Jour affiché</legend>
            {(['today', 'tomorrow'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onDayViewChange(key)}
                className={[
                  'rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors',
                  dayView === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900',
                ].join(' ')}
              >
                {key === 'today' ? "Aujourd'hui" : 'Demain'}
              </button>
            ))}
          </fieldset>
          <Link
            to="/calendrier"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87]"
          >
            Calendrier
            <Calendar className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {!hasItems ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-14 text-center">
            <Calendar className="mx-auto h-10 w-10 text-zinc-300" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 text-sm font-semibold text-zinc-700">
              Aucune location ni indisponibilité {dayView === 'today' ? "aujourd'hui" : 'demain'}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Les créneaux annulés ne sont pas listés. Planifiez une location ou une indisponibilité depuis le
              calendrier.
            </p>
            <Link
              to="/calendrier"
              className="mt-4 inline-flex items-center gap-1 rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden />
              Ouvrir le calendrier
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {pendingCount > 0 ? (
              <RentalSection
                title="À traiter"
                subtitle="Check-in ou check-out en attente"
                accent="amber"
                dense={dense}
                scrollable={pendingCount >= SCROLL_THRESHOLD}
              >
                {pendingReservations.map((r) => (
                  <RentalRow
                    key={r.id}
                    reservation={r}
                    boatsById={boatsById}
                    tablet={tabletByReservationId.get(r.id)}
                    dense={dense}
                    highlight
                  />
                ))}
              </RentalSection>
            ) : null}

            {readyReservations.length > 0 ? (
              <RentalSection
                title={pendingCount > 0 ? 'Autres locations' : 'Locations'}
                subtitle={pendingCount > 0 ? 'Formulaires complétés' : undefined}
                dense={dense}
                scrollable={readyReservations.length >= SCROLL_THRESHOLD}
              >
                {readyReservations.map((r) => (
                  <RentalRow
                    key={r.id}
                    reservation={r}
                    boatsById={boatsById}
                    tablet={tabletByReservationId.get(r.id)}
                    dense={dense}
                  />
                ))}
              </RentalSection>
            ) : null}

            {unavailCount > 0 ? (
              <div>
                <button
                  type="button"
                  onClick={() => setUnavailOpen((v) => !v)}
                  className="mb-2 flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-zinc-50"
                  aria-expanded={unavailOpen}
                >
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-700">
                      Indisponibilités
                      <span className="ml-2 font-normal text-zinc-400">({unavailCount})</span>
                    </h3>
                    {!unavailOpen ? (
                      <p className="mt-0.5 text-xs text-zinc-400">Cliquer pour afficher</p>
                    ) : null}
                  </div>
                  <ChevronDown
                    className={[
                      'h-4 w-4 shrink-0 text-zinc-400 transition-transform',
                      unavailOpen ? 'rotate-180' : '',
                    ].join(' ')}
                    aria-hidden
                  />
                </button>
                {unavailOpen ? (
                  <UnavailabilityList
                    items={unavailabilities}
                    boatsById={boatsById}
                    dense={dense}
                    scrollable={unavailCount >= SCROLL_THRESHOLD}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {hasItems ? (
          <p className="mt-4 text-center text-xs text-zinc-400 sm:text-left">
            Détail sur{' '}
            <Link to="/calendrier" className="font-semibold text-[#416B9F] hover:underline">
              Calendrier
            </Link>
            {rentalCount > 0 ? (
              <>
                {' '}
                ou{' '}
                <Link to="/reservations" className="font-semibold text-[#416B9F] hover:underline">
                  Réservations
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function RentalSection(props: Readonly<{
  title: string;
  subtitle?: string;
  accent?: 'amber';
  dense: boolean;
  scrollable: boolean;
  children: React.ReactNode;
}>) {
  const { title, subtitle, accent, dense, scrollable, children } = props;
  const borderClass =
    accent === 'amber' ? 'border-amber-200/80 bg-amber-50/30' : 'border-zinc-200/90 bg-white';

  return (
    <div>
      <div className="mb-2 px-1">
        <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
        {subtitle ? <p className="text-xs text-zinc-400">{subtitle}</p> : null}
      </div>
      <ul
        className={[
          'divide-y overflow-hidden rounded-xl border',
          borderClass,
          scrollable ? 'max-h-[min(50vh,22rem)] overflow-y-auto' : '',
        ].join(' ')}
      >
        {dense ? (
          <li className="hidden border-b border-zinc-100 bg-zinc-50/80 px-4 py-2 md:grid md:grid-cols-[4.5rem_minmax(0,1fr)_auto_1.25rem] md:items-center md:gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Horaire</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Location</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Checks</span>
            <span className="sr-only">Détail</span>
          </li>
        ) : null}
        {children}
      </ul>
    </div>
  );
}

function RentalRow(props: Readonly<{
  reservation: Reservation;
  boatsById: Map<string, BoatLookup>;
  tablet?: TabletReservationRow;
  dense: boolean;
  highlight?: boolean;
}>) {
  const { reservation: r, boatsById, tablet, dense, highlight } = props;
  const boat = boatsById.get(r.boatId);
  const badge = reservationStatusBadge(r);
  const client = reservationClientLabel(r);
  const showClient = client && client.toLowerCase() !== r.title.trim().toLowerCase();
  const { checkInDone, checkOutDone } = checkFlags(r, tablet);
  const { timeStart, timeEnd } = formatTimeRange(r.start, r.end);
  const boatName = boat ? `${boat.brand ?? ''} ${boat.name}`.trim() : 'Bateau inconnu';

  return (
    <li>
      <Link
        to="/reservations"
        className={[
          'group flex items-center gap-3 transition-colors',
          dense
            ? 'px-4 py-2.5 md:grid md:grid-cols-[4.5rem_minmax(0,1fr)_auto_1.25rem] md:items-center md:gap-3'
            : 'rounded-xl px-4 py-3.5',
          highlight
            ? 'bg-amber-50/50 hover:bg-amber-50/80'
            : dense
              ? 'hover:bg-zinc-50/80'
              : 'rounded-xl border border-zinc-200/80 bg-zinc-50/20 hover:bg-zinc-50/60',
        ].join(' ')}
      >
        <div className={dense ? 'shrink-0' : 'hidden shrink-0 sm:block sm:min-w-[4rem]'}>
          <p className="text-sm font-bold tabular-nums text-zinc-900">{timeStart}</p>
          <p className="text-[11px] tabular-nums text-zinc-400">→ {timeEnd}</p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="truncate text-sm font-semibold text-zinc-900">{r.title}</p>
            <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold leading-tight ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          {showClient ? <p className="truncate text-xs text-zinc-500">{client}</p> : null}
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
            <Ship className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
            <span className="truncate">{boatName}</span>
            {!dense ? (
              <span className="text-zinc-300 sm:hidden">·</span>
            ) : null}
            <span className="tabular-nums text-zinc-400 sm:hidden">
              {timeStart}–{timeEnd}
            </span>
          </p>
        </div>

        <div className={dense ? 'flex shrink-0 items-center gap-1' : 'mt-0 flex shrink-0 flex-wrap gap-1.5'}>
          <CheckIndicator done={checkInDone} label="Check-in" Icon={LogIn} compact={dense} />
          <CheckIndicator done={checkOutDone} label="Check-out" Icon={LogOut} compact={dense} />
        </div>

        <ChevronRight
          className="h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400"
          aria-hidden
        />
      </Link>
    </li>
  );
}

function UnavailabilityList(props: Readonly<{
  items: BoatUnavailability[];
  boatsById: Map<string, BoatLookup>;
  dense: boolean;
  scrollable: boolean;
}>) {
  const sorted = [...props.items].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  return (
    <ul
      className={[
        'divide-y overflow-hidden rounded-xl border border-zinc-200/70 bg-zinc-50/50',
        props.scrollable ? 'max-h-[min(40vh,16rem)] overflow-y-auto' : '',
      ].join(' ')}
    >
      {sorted.map((item) => (
        <UnavailabilityRow key={item.id} item={item} boatsById={props.boatsById} dense={props.dense} />
      ))}
    </ul>
  );
}

function UnavailabilityRow(props: Readonly<{
  item: BoatUnavailability;
  boatsById: Map<string, BoatLookup>;
  dense: boolean;
}>) {
  const { item, boatsById, dense } = props;
  const start = new Date(item.startAt);
  const end = new Date(item.endAt);
  const { timeStart, timeEnd } = formatTimeRange(start, end);

  return (
    <li>
      <Link
        to={`/calendrier?unavail=${item.id}`}
        className={[
          'group flex items-center gap-3 px-4 transition-colors hover:bg-zinc-100/80',
          dense ? 'py-2 md:grid md:grid-cols-[4.5rem_minmax(0,1fr)_1.25rem] md:items-center md:gap-3' : 'py-3',
        ].join(' ')}
      >
        <div className="shrink-0">
          <p className="text-sm font-semibold tabular-nums text-zinc-700">{timeStart}</p>
          <p className="text-[11px] tabular-nums text-zinc-400">→ {timeEnd}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="truncate text-sm font-medium text-zinc-700">{item.title}</p>
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-zinc-500/90 px-1.5 py-px text-[10px] font-semibold text-white">
              <Ban className="h-2.5 w-2.5" aria-hidden />
              Indispo.
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
            <Ship className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
            <span className="truncate">{boatLabel(boatsById, item.boatId, item.boat)}</span>
            {item.note ? (
              <>
                <span className="text-zinc-300">·</span>
                <span className="truncate italic text-zinc-400">{item.note}</span>
              </>
            ) : null}
          </p>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400"
          aria-hidden
        />
      </Link>
    </li>
  );
}

function CheckIndicator(props: Readonly<{
  done: boolean;
  label: string;
  Icon: typeof LogIn;
  compact: boolean;
}>) {
  const { done, label, Icon, compact } = props;

  if (compact) {
    return (
      <span
        title={`${label}${done ? ' — fait' : ' — à faire'}`}
        className={[
          'inline-flex h-7 w-7 items-center justify-center rounded-lg',
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200/70 text-zinc-500',
        ].join(' ')}
        aria-label={`${label}${done ? ', fait' : ', à faire'}`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold',
        done ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200/80 text-zinc-600',
      ].join(' ')}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
      {done ? ' ✓' : ''}
    </span>
  );
}
