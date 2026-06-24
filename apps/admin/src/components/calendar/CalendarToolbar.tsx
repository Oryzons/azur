import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CalendarRange, Calendar, ChevronLeft, ChevronRight, Clock, PackagePlus } from 'lucide-react';
import {
  dayToIso,
  formatCalendarToolbarPeriod,
  isTodayInCalendarPeriod,
  type ViewMode,
} from '@/pages/calendar/calendarConstants';
import { FleetPicker } from '@/components/calendar/FleetPicker';
import { CalendarDatePickerPopover } from '@/components/calendar/CalendarDatePickerPopover';

const VIEW_OPTIONS: { k: ViewMode; label: string; Icon: typeof CalendarDays }[] = [
  { k: 'month', label: 'Mois', Icon: CalendarDays },
  { k: 'week', label: 'Semaine', Icon: CalendarRange },
  { k: 'day', label: 'Jour', Icon: Calendar },
];

type Fleet = { id: string; name: string };
type PeriodAnim = 'left' | 'right' | 'fade';

export function CalendarToolbar(props: Readonly<{
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  periodStart: Date;
  periodEnd: Date;
  cursorDate: Date;
  eventCount?: number;
  onDateSelect: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  fleetId?: string;
  fleets?: Fleet[];
  onFleetChange?: (fleetId: string) => void;
  onExtraRental?: () => void;
}>) {
  const {
    view,
    onViewChange,
    periodStart,
    periodEnd,
    cursorDate,
    eventCount = 0,
    onDateSelect,
    onPrev,
    onNext,
    onToday,
    fleetId = '',
    fleets = [],
    onFleetChange,
    onExtraRental,
  } = props;

  const showFleet = Boolean(onFleetChange && fleets.length > 0);
  const viewSwitcherRef = useRef<HTMLFieldSetElement>(null);
  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [viewIndicator, setViewIndicator] = useState({ left: 0, width: 0, ready: false });
  const [periodAnim, setPeriodAnim] = useState<PeriodAnim>('fade');

  const periodLabel = useMemo(
    () => formatCalendarToolbarPeriod(view, periodStart, periodEnd, cursorDate),
    [view, periodStart, periodEnd, cursorDate],
  );
  const showTodayChip = !isTodayInCalendarPeriod(periodStart, periodEnd);
  const periodLabelKey = useMemo(() => {
    if (view === 'month') {
      return `${cursorDate.getFullYear()}-${cursorDate.getMonth()}`;
    }
    if (view === 'week') {
      return `${periodStart.toISOString()}-${periodEnd.toISOString()}`;
    }
    return dayToIso(cursorDate);
  }, [view, cursorDate, periodStart, periodEnd]);

  useEffect(() => {
    if (periodAnim === 'fade') return;
    const t = window.setTimeout(() => setPeriodAnim('fade'), 320);
    return () => window.clearTimeout(t);
  }, [periodLabelKey, periodAnim]);

  function handleDateSelect(date: Date) {
    setPeriodAnim('fade');
    onDateSelect(date);
  }

  useLayoutEffect(() => {
    const container = viewSwitcherRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(`[data-cal-view="${view}"]`);
    if (!active) return;
    setViewIndicator({
      left: active.offsetLeft,
      width: active.offsetWidth,
      ready: true,
    });
  }, [view]);

  function periodAnimClass(dir: PeriodAnim) {
    if (dir === 'left') return 'bc-cal-period-from-left';
    if (dir === 'right') return 'bc-cal-period-from-right';
    return 'bc-cal-period-fade';
  }

  return (
    <div className="relative z-40 bc-content-enter rounded-2xl border border-zinc-200/90 bg-white p-2 shadow-sm shadow-zinc-200/30 sm:p-2.5">
      <CalendarDatePickerPopover
        open={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        selected={cursorDate}
        onSelect={handleDateSelect}
        anchorRef={dateBtnRef}
      />

      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto sm:gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => {
            setPeriodAnim('left');
            onPrev();
          }}
          className="bc-interactive flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200/90 bg-white text-zinc-600 shadow-sm hover:border-zinc-300 hover:bg-zinc-50 sm:h-9 sm:w-9"
          aria-label="Période précédente"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>

        <button
          ref={dateBtnRef}
          type="button"
          onClick={() => setDatePickerOpen((v) => !v)}
          title="Choisir une date"
          aria-expanded={datePickerOpen}
          aria-haspopup="dialog"
          className={[
            'bc-interactive group min-w-0 max-w-[9.5rem] shrink rounded-xl px-1 py-0.5 text-left sm:max-w-[14rem] md:max-w-none',
            datePickerOpen ? 'bg-[#416B9F]/8 ring-2 ring-[#416B9F]/20' : 'hover:bg-zinc-50',
          ].join(' ')}
        >
          <span
            key={periodLabelKey}
            className={[
              'block truncate whitespace-nowrap text-sm font-bold capitalize tracking-tight text-zinc-900 sm:text-base md:text-lg',
              periodAnimClass(periodAnim),
            ].join(' ')}
          >
            {periodLabel}
          </span>
        </button>

        {eventCount > 0 ? (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white shadow-sm sm:gap-1 sm:px-2.5 sm:py-1 sm:text-xs"
            title={`${eventCount} événement${eventCount > 1 ? 's' : ''}`}
          >
            <Clock className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            {eventCount}
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setPeriodAnim('right');
            onNext();
          }}
          className="bc-interactive flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200/90 bg-white text-zinc-600 shadow-sm hover:border-zinc-300 hover:bg-zinc-50 sm:h-9 sm:w-9"
          aria-label="Période suivante"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>

        {showTodayChip ? (
          <button
            type="button"
            onClick={() => {
              setPeriodAnim('fade');
              onToday();
            }}
            className="bc-interactive shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-zinc-200/80 hover:bg-zinc-200/70 sm:px-3 sm:py-1.5 sm:text-xs"
          >
            <span className="sm:hidden">Auj.</span>
            <span className="hidden sm:inline">Aujourd’hui</span>
          </button>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <fieldset ref={viewSwitcherRef} className="relative inline-flex shrink-0 rounded-xl bg-zinc-100/80 p-0.5 sm:p-1">
            <legend className="sr-only">Vue du calendrier</legend>
            <span
              aria-hidden
              className={[
                'bc-cal-view-indicator pointer-events-none absolute rounded-lg bg-white shadow-sm ring-1 ring-zinc-200/80',
                'top-0.5 bottom-0.5 sm:top-1 sm:bottom-1',
                viewIndicator.ready ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
              style={{ left: viewIndicator.left, width: viewIndicator.width }}
            />
            {VIEW_OPTIONS.map(({ k, label, Icon }) => {
              const active = view === k;
              return (
                <button
                  key={k}
                  type="button"
                  data-cal-view={k}
                  onClick={() => {
                    setPeriodAnim('fade');
                    onViewChange(k);
                  }}
                  className={[
                    'bc-interactive relative z-10 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm',
                    active ? 'text-zinc-900' : 'text-zinc-600 hover:text-zinc-900',
                  ].join(' ')}
                  title={label}
                >
                  <Icon
                    className={[
                      'h-3.5 w-3.5 transition-transform duration-200 sm:h-4 sm:w-4',
                      active ? 'scale-110' : 'scale-100',
                    ].join(' ')}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="hidden md:inline">{label}</span>
                </button>
              );
            })}
          </fieldset>

          {showFleet ? (
            <FleetPicker fleetId={fleetId} fleets={fleets} onChange={(id) => onFleetChange?.(id)} compact />
          ) : null}

          {onExtraRental ? (
            <button
              type="button"
              onClick={onExtraRental}
              title="Louer un extra"
              className="bc-interactive group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-[#416B9F] px-2.5 text-xs font-semibold text-white shadow-sm shadow-[#416B9F]/20 hover:bg-[#365b87] hover:shadow-md hover:shadow-[#416B9F]/25 sm:h-9 sm:gap-2 sm:px-3.5 sm:text-sm md:px-4"
            >
              <PackagePlus className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:rotate-6" strokeWidth={2} aria-hidden />
              <span className="hidden lg:inline">Louer un extra</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
