import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Ship } from 'lucide-react';
import { addDays } from '@/pages/calendar/calendarConstants';
import { deserializeReservation, seedDemoReservationsIfEmpty, useReservationsStore } from '@/stores/reservations';
import { useBoatsStore, type Boat } from '@/stores/boats';
import { useExtrasStore } from '@/stores/extras';
import { useCouponsStore } from '@/stores/coupons';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import type { Coupon } from '@/stores/coupons';
import type { Extra } from '@/stores/extras';
import {
  buildComptabiliteRows,
  defaultWeekStart,
  downloadBoatWeekCsv,
  formatWeekLabel,
  parseWeekInput,
  rowsForBoat,
  weekInputValue,
  type ComptabiliteRow,
} from './comptabiliteExport';

function WeekPicker(props: Readonly<{
  weekStart: Date;
  onChange: (weekStart: Date) => void;
  compact?: boolean;
}>) {
  const { weekStart, onChange, compact = false } = props;

  return (
    <div className={['flex flex-wrap items-center gap-2', compact ? '' : 'gap-3'].join(' ')}>
      <div className="inline-flex items-center gap-0.5 rounded-xl border border-zinc-200/90 bg-white p-0.5 shadow-sm">
        <button
          type="button"
          onClick={() => onChange(addDays(weekStart, -7))}
          className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onChange(defaultWeekStart())}
          className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#416B9F] hover:bg-[#416B9F]/10"
        >
          Cette semaine
        </button>
        <button
          type="button"
          onClick={() => onChange(addDays(weekStart, 7))}
          className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100"
          aria-label="Semaine suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <input
        type="week"
        value={weekInputValue(weekStart)}
        onChange={(e) => {
          const parsed = parseWeekInput(e.target.value);
          if (parsed) onChange(parsed);
        }}
        className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs text-zinc-700"
        aria-label="Choisir la semaine"
      />
      <span className="text-xs font-medium text-zinc-600">{formatWeekLabel(weekStart)}</span>
    </div>
  );
}

function BoatSection(props: Readonly<{
  boat: Boat;
  boatName: string;
  reservations: readonly Reservation[];
  extrasCatalog: readonly Extra[];
  couponsCatalog: readonly Coupon[];
}>) {
  const { boat, boatName, reservations, extrasCatalog, couponsCatalog } = props;
  const [weekStart, setWeekStart] = useState(defaultWeekStart);

  const rows = useMemo(
    () => rowsForBoat(buildComptabiliteRows(reservations, [boat], extrasCatalog, couponsCatalog, weekStart), boat.id),
    [boat, couponsCatalog, extrasCatalog, reservations, weekStart],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
      <div className="space-y-4 border-b border-zinc-100 bg-zinc-50/80 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#416B9F]/10 text-[#416B9F]">
            <Ship className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-zinc-900">{boatName}</h2>
            <p className="text-xs text-zinc-500">
              {rows.length} location{rows.length !== 1 ? 's' : ''} sur la semaine sélectionnée
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <WeekPicker weekStart={weekStart} onChange={setWeekStart} compact />
          <button
            type="button"
            onClick={() => downloadBoatWeekCsv(rows, boat, weekStart)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#416B9F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#365b87]"
          >
            <Download className="h-4 w-4" aria-hidden />
            Télécharger cette semaine
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-zinc-500">Aucune location sur cette semaine.</p>
      ) : (
        <BoatTable rows={rows} />
      )}
    </section>
  );
}

function BoatTable({ rows }: Readonly<{ rows: ComptabiliteRow[] }>) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-white text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            <th className="px-4 py-3">Jour</th>
            <th className="px-4 py-3">Créneau</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3 text-right">Location</th>
            <th className="px-4 py-3 text-right">Remise</th>
            <th className="px-4 py-3">Coupon</th>
            <th className="px-4 py-3 text-right">Avoir</th>
            <th className="px-4 py-3 text-right">Total TTC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.reservationId} className="border-b border-zinc-50 hover:bg-zinc-50/60">
              <td className="whitespace-nowrap px-4 py-3">
                <span className="font-medium text-zinc-800">{row.dayLabel}</span>
                <span className="mt-0.5 block text-xs text-zinc-500">{row.startDate}</span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                {row.startTime} – {row.endTime}
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-zinc-900">
                  {[row.civility, row.firstName, row.lastName].filter(Boolean).join(' ')}
                </p>
                <p className="text-xs text-zinc-500">{row.email}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-700">{row.status}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{row.rentalBrut} €</td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {row.discountPct !== '0' ? `${row.discountPct} %` : '—'}
              </td>
              <td className="px-4 py-3">
                {row.couponCode ? (
                  <>
                    <span className="font-medium text-zinc-800">{row.couponCode}</span>
                    {row.couponDiscount !== '—' ? (
                      <span className="mt-0.5 block text-xs text-zinc-500">−{row.couponDiscount} €</span>
                    ) : null}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {row.storeCredit !== '—' ? `${row.storeCredit} €` : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-zinc-900">
                {row.totalTtc} €
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ComptabilitePage() {
  const rawItems = useReservationsStore((s) => s.items);
  const reservations = useMemo(() => rawItems.map(deserializeReservation), [rawItems]);
  const reservationsHydrated = useReservationsStore((s) => s.hydrated);
  const refreshReservations = useReservationsStore((s) => s.refresh);

  const boats = useBoatsStore((s) => s.boats);
  const boatsHydrated = useBoatsStore((s) => s.hydrated);
  const refreshBoats = useBoatsStore((s) => s.refresh);

  const extrasCatalog = useExtrasStore((s) => s.extras);
  const extrasHydrated = useExtrasStore((s) => s.hydrated);
  const refreshExtras = useExtrasStore((s) => s.refresh);

  const couponsCatalog = useCouponsStore((s) => s.coupons);
  const couponsHydrated = useCouponsStore((s) => s.hydrated);
  const refreshCoupons = useCouponsStore((s) => s.refresh);

  useEffect(() => {
    if (!reservationsHydrated) void refreshReservations();
    seedDemoReservationsIfEmpty();
  }, [reservationsHydrated, refreshReservations]);
  useEffect(() => {
    if (!boatsHydrated) void refreshBoats();
  }, [boatsHydrated, refreshBoats]);
  useEffect(() => {
    if (!extrasHydrated) void refreshExtras();
  }, [extrasHydrated, refreshExtras]);
  useEffect(() => {
    if (!couponsHydrated) void refreshCoupons();
  }, [couponsHydrated, refreshCoupons]);

  const sortedBoats = useMemo(() => {
    return [...boats].sort((a, b) => {
      const la = (a.name || `${a.brand} ${a.model}`).trim();
      const lb = (b.name || `${b.brand} ${b.model}`).trim();
      return la.localeCompare(lb, 'fr');
    });
  }, [boats]);

  const dataReady = reservationsHydrated && boatsHydrated && extrasHydrated && couponsHydrated;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Comptabilité</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-zinc-500">
          Pour chaque bateau, choisissez la semaine à consulter ou à exporter en CSV (client, tarifs, remises,
          coupons, avoirs, paiements…).
        </p>
      </div>

      {!dataReady ? (
        <p className="text-sm text-zinc-500">Chargement des réservations et bateaux…</p>
      ) : (
        <div className="space-y-6">
          {sortedBoats.map((boat) => {
            const label = boat.name?.trim() || `${boat.brand} ${boat.model}`.trim() || boat.id;
            return (
              <BoatSection
                key={boat.id}
                boat={boat}
                boatName={label}
                reservations={reservations}
                extrasCatalog={extrasCatalog}
                couponsCatalog={couponsCatalog}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
