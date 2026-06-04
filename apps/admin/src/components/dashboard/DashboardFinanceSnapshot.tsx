import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { DashboardSectionCard } from '@/components/dashboard/DashboardSectionCard';
import { addDays, startOfDay, startOfMonth, startOfWeekMonday } from '@/pages/calendar/calendarConstants';
import { euro, sumTotals } from '@/pages/finances/pricingTotals';
import { deserializeReservation, useReservationsStore } from '@/stores/reservations';
import { useExtrasStore } from '@/stores/extras';
import { useCouponsStore } from '@/stores/coupons';
import { Wallet } from 'lucide-react';

export function DashboardFinanceSnapshot() {
  const rawItems = useReservationsStore((s) => s.items);
  const reservations = useMemo(() => rawItems.map(deserializeReservation), [rawItems]);
  const extrasCatalog = useExtrasStore((s) => s.extras);
  const couponsCatalog = useCouponsStore((s) => s.coupons);
  const couponRedemptions = useCouponsStore((s) => s.redemptions);

  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);
  const weekStart = startOfWeekMonday(now);
  const weekEnd = addDays(weekStart, 7);
  const monthStart = startOfMonth(now);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  const sums = useMemo(
    () => ({
      day: sumTotals(reservations, { start: dayStart, endExclusive: dayEnd }, extrasCatalog, couponsCatalog, couponRedemptions),
      week: sumTotals(reservations, { start: weekStart, endExclusive: weekEnd }, extrasCatalog, couponsCatalog, couponRedemptions),
      month: sumTotals(reservations, { start: monthStart, endExclusive: monthEnd }, extrasCatalog, couponsCatalog, couponRedemptions),
    }),
    [
      couponRedemptions,
      couponsCatalog,
      dayEnd,
      dayStart,
      extrasCatalog,
      monthEnd,
      monthStart,
      reservations,
      weekEnd,
      weekStart,
    ],
  );

  const rows = [
    { key: 'day', label: "Aujourd'hui", data: sums.day },
    { key: 'week', label: 'Semaine', data: sums.week },
    { key: 'month', label: 'Mois', data: sums.month },
  ] as const;

  return (
    <DashboardSectionCard
      title="Finances"
      description="Chiffre d'affaires location + extras (hors annulées)."
      icon={Wallet}
      href="/finances"
      hrefLabel="Détails"
    >
      <ul className="grid gap-3 sm:grid-cols-3">
        {rows.map(({ key, label, data }) => (
          <li
            key={key}
            className="flex flex-col justify-between rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3.5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">
              <AnimatedNumber value={data.total} format={(n) => `${euro(n)} €`} />
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              <span className="font-semibold tabular-nums text-zinc-700">{data.count}</span> réservation
              {data.count !== 1 ? 's' : ''}
            </p>
          </li>
        ))}
      </ul>
      <Link
        to="/finances"
        className="mt-5 block text-center text-sm font-semibold text-[#416B9F] hover:underline sm:text-left"
      >
        Analyse et graphiques →
      </Link>
    </DashboardSectionCard>
  );
}
