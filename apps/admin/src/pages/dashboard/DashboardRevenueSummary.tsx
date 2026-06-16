import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Wallet } from 'lucide-react';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { addDays, startOfDay, startOfMonth, startOfWeekMonday } from '@/pages/calendar/calendarConstants';
import { euro, sumTotals } from '@/pages/finances/pricingTotals';
import { deserializeReservation, seedDemoReservationsIfEmpty, useReservationsStore } from '@/stores/reservations';
import { useExtrasStore } from '@/stores/extras';
import { useCouponsStore } from '@/stores/coupons';
import { MetricCardSkeleton } from '@/components/skeletons/PageSkeletons';

type CaRange = 'day' | 'week' | 'month';

const RANGE_LABELS: Record<CaRange, string> = {
  day: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
};

export function DashboardRevenueSummary() {
  const [range, setRange] = useState<CaRange>('week');

  const rawItems = useReservationsStore((s) => s.items);
  const reservations = useMemo(() => rawItems.map(deserializeReservation), [rawItems]);
  const reservationsHydrated = useReservationsStore((s) => s.hydrated);
  const refreshReservations = useReservationsStore((s) => s.refresh);

  const extrasCatalog = useExtrasStore((s) => s.extras);
  const extrasHydrated = useExtrasStore((s) => s.hydrated);
  const refreshExtras = useExtrasStore((s) => s.refresh);

  const couponsCatalog = useCouponsStore((s) => s.coupons);
  const couponsHydrated = useCouponsStore((s) => s.hydrated);
  const refreshCoupons = useCouponsStore((s) => s.refresh);

  useEffect(() => {
    if (!reservationsHydrated) refreshReservations().catch(() => undefined);
    seedDemoReservationsIfEmpty();
  }, [reservationsHydrated, refreshReservations]);
  useEffect(() => {
    if (!extrasHydrated) refreshExtras().catch(() => undefined);
  }, [extrasHydrated, refreshExtras]);
  useEffect(() => {
    if (!couponsHydrated) refreshCoupons().catch(() => undefined);
  }, [couponsHydrated, refreshCoupons]);

  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);
  const weekStart = startOfWeekMonday(now);
  const weekEnd = addDays(weekStart, 7);
  const monthStart = startOfMonth(now);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  const sums = useMemo(
    () => ({
      day: sumTotals(reservations, { start: dayStart, endExclusive: dayEnd }, extrasCatalog, couponsCatalog),
      week: sumTotals(reservations, { start: weekStart, endExclusive: weekEnd }, extrasCatalog, couponsCatalog),
      month: sumTotals(reservations, { start: monthStart, endExclusive: monthEnd }, extrasCatalog, couponsCatalog),
    }),
    [couponsCatalog, dayEnd, dayStart, extrasCatalog, monthEnd, monthStart, reservations, weekEnd, weekStart],
  );

  const selected = sums[range];

  const dataReady = reservationsHydrated && extrasHydrated && couponsHydrated;
  if (!dataReady) return <MetricCardSkeleton />;

  return (
    <section
      aria-labelledby="dashboard-ca-title"
      className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#416B9F]/10 text-[#416B9F]">
            <Wallet className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <h2 id="dashboard-ca-title" className="text-base font-semibold text-zinc-900">
              Chiffre d&apos;affaires
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Location, extras et remises — aligné sur la page{' '}
              <Link to="/finances" className="font-semibold text-[#416B9F] hover:underline">
                Finances
              </Link>
              .
            </p>
          </div>
        </div>

        <fieldset className="inline-flex rounded-xl border border-zinc-200/90 bg-zinc-50 p-1">
          <legend className="sr-only">Période</legend>
          {(['day', 'week', 'month'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={[
                'rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                range === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900',
              ].join(' ')}
            >
              {RANGE_LABELS[key]}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{RANGE_LABELS[range]}</p>
          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-zinc-900">
            <AnimatedNumber value={selected.total} format={(n) => `${euro(n)} €`} />
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/90 px-4 py-3 text-center min-w-[5.5rem]">
            <p className="text-2xl font-bold tabular-nums text-zinc-900">{selected.count}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">réservations</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4 text-sm">
        <Link
          to="/finances"
          className="inline-flex items-center gap-1.5 font-semibold text-[#416B9F] hover:underline"
        >
          <BarChart3 className="h-4 w-4" aria-hidden />
          Analyse complète
        </Link>
        <span className="text-zinc-300" aria-hidden>
          ·
        </span>
        <p className="text-xs text-zinc-400">Les créneaux sans tarif renseigné ne sont pas inclus dans le total.</p>
      </div>
    </section>
  );
}
