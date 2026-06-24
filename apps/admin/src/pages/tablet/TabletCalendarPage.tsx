import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TabletReservationCard } from '@/components/tablet/TabletReservationCard';
import { fmtTabletDate, todayIso } from '@/lib/tablet';
import { subscribeTabletCalendarRefresh } from '@/lib/tabletRealtime';
import { TB } from '@/lib/tabletTheme';
import { useTabletDayReservations } from '@/pages/tablet/useTabletDayReservations';
import { useCheckFlowStore } from '@/stores/checkFlow';

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function weekAround(iso: string): string[] {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return x.toISOString().slice(0, 10);
  });
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
}

function useWeekCounts(weekDays: string[]) {
  const fetchTablet = useCheckFlowStore((s) => s.fetchTabletReservations);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const weekKey = weekDays.join(',');

  const reload = useCallback(() => {
    let cancelled = false;
    void Promise.all(
      weekDays.map(async (d) => {
        const rows = await fetchTablet(d);
        return [d, rows.length] as const;
      }),
    ).then((pairs) => {
      if (!cancelled) setCounts(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [weekKey, fetchTablet, weekDays]);

  useEffect(() => {
    const cancel = reload();
    return cancel;
  }, [reload]);

  useEffect(() => subscribeTabletCalendarRefresh(reload), [reload]);

  return counts;
}

export function TabletCalendarPage() {
  const [day, setDay] = useState(todayIso);
  const weekDays = useMemo(() => weekAround(day), [day]);
  const counts = useWeekCounts(weekDays);
  const { rows, loading, error } = useTabletDayReservations(day);

  return (
    <div className={TB.page}>
      <h1 className={TB.h1}>Calendrier</h1>
      <p className={TB.subtitle}>{fmtTabletDate(`${day}T12:00:00`)}</p>

      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setDay(addDaysIso(day, -7))}
          className={TB.iconBtn}
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => setDay(todayIso())} className={TB.btnSecondary}>
          Aujourd&apos;hui
        </button>
        <button
          type="button"
          onClick={() => setDay(addDaysIso(day, 7))}
          className={TB.iconBtn}
          aria-label="Semaine suivante"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {weekDays.map((d) => {
          const active = d === day;
          const isToday = d === todayIso();
          const n = counts[d] ?? 0;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={[
                'flex min-h-[4.5rem] flex-col items-center justify-center rounded-2xl px-1 py-2 text-center touch-manipulation shadow-sm',
                active
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                  : 'border border-zinc-200/80 bg-white text-zinc-600',
                isToday && !active ? 'ring-2 ring-blue-500/30' : '',
              ].join(' ')}
            >
              <span className="text-[10px] font-semibold uppercase opacity-80">
                {dayLabel(d).split(' ')[0]}
              </span>
              <span className="text-base font-bold">{d.slice(8, 10)}</span>
              {n > 0 ? (
                <span
                  className={[
                    'mt-0.5 rounded-full px-1.5 text-[10px] font-bold',
                    active ? 'bg-white/25 text-white' : 'bg-blue-500/10 text-blue-600',
                  ].join(' ')}
                >
                  {n}
                </span>
              ) : (
                <span className="mt-0.5 h-4" />
              )}
            </button>
          );
        })}
      </div>

      {error ? <p className={`mt-6 ${TB.error}`}>{error}</p> : null}

      {loading ? (
        <p className={`mt-8 ${TB.empty}`}>Chargement…</p>
      ) : rows.length === 0 ? (
        <p className={`mt-8 ${TB.empty}`}>Aucune réservation ce jour.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <TabletReservationCard key={r.id} reservation={r} compact />
          ))}
        </ul>
      )}

      <p className="mt-6 text-center">
        <Link to="/tablette/reservations" className="text-sm font-semibold text-zinc-700 hover:underline">
          Voir toutes les réservations du jour →
        </Link>
      </p>
    </div>
  );
}
