import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  Banknote,
  CircleDollarSign,
  CreditCard,
  Landmark,
  PiggyBank,
  Receipt,
  RotateCcw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { DonutChart, type DonutSegment } from '@/components/charts/DonutChart';
import { MiniBarChart } from '@/components/charts/MiniBarChart';
import { FinancesPageSkeleton } from '@/components/skeletons/FinancesPageSkeleton';
import { statusBadgeClass, statusLabel } from '@/lib/reservationStatus';
import { deserializeReservation, seedDemoReservationsIfEmpty, useReservationsStore } from '@/stores/reservations';
import { useExtrasStore } from '@/stores/extras';
import { useCouponsStore } from '@/stores/coupons';
import { euro } from './pricingTotals';
import {
  getPeriodRange,
  PAYMENT_METHOD_COLORS,
  PAYMENT_METHOD_LABELS,
  safeBuildFinancesReport,
  STATUS_COLORS,
  type FinancesPeriod,
  type PaymentMethodKey,
} from './financesAnalytics';
import type { ReservationStatus } from '@/lib/reservationStatus';

const PERIOD_LABELS: Record<FinancesPeriod, string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
  year: 'Année',
};

function KpiCard(props: Readonly<{
  title: string;
  subtitle: string;
  amount: number;
  icon: ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'danger' | 'neutral';
  badge?: string;
}>) {
  const { title, subtitle, amount, icon, tone = 'default', badge } = props;
  const toneCls =
    tone === 'positive'
      ? 'border-emerald-200/80 bg-emerald-50/50'
      : tone === 'warning'
        ? 'border-amber-200/80 bg-amber-50/40'
        : tone === 'danger'
          ? 'border-red-200/80 bg-red-50/40'
          : tone === 'neutral'
            ? 'border-zinc-200/90 bg-zinc-50/80'
            : 'border-[#416B9F]/20 bg-gradient-to-br from-[#416B9F]/6 to-white';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneCls}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-[#416B9F] shadow-sm ring-1 ring-zinc-200/80">
          {icon}
        </div>
        {badge ? (
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 ring-1 ring-zinc-200/80">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-zinc-900">
        <AnimatedNumber value={amount} format={(n) => `${euro(n)} €`} />
      </p>
      <p className="mt-1 text-[11px] text-zinc-500">{subtitle}</p>
    </div>
  );
}

function ChartPanel({ title, subtitle, children }: Readonly<{ title: string; subtitle: string; children: ReactNode }>) {
  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const STATUS_ORDER: ReservationStatus[] = [
  'reserved_paid',
  'pending_payment',
  'partially_refunded',
  'refunded',
  'cancelled',
];

const PAYMENT_ORDER: PaymentMethodKey[] = [
  'carte_en_ligne',
  'espece',
  'virement',
  'prelevement',
  'cheque',
  'carte_hors_ligne',
  'hors_ligne_autre',
  'en_attente',
];

export function FinancesPage() {
  const rawItems = useReservationsStore((s) => s.items);
  const reservations = useMemo(() => rawItems.map(deserializeReservation), [rawItems]);
  const reservationsHydrated = useReservationsStore((s) => s.hydrated);
  const refreshReservations = useReservationsStore((s) => s.refresh);
  const extrasCatalog = useExtrasStore((s) => s.extras);
  const extrasHydrated = useExtrasStore((s) => s.hydrated);
  const refreshExtras = useExtrasStore((s) => s.refresh);
  const couponsCatalog = useCouponsStore((s) => s.coupons);
  const couponRedemptions = useCouponsStore((s) => s.redemptions);
  const couponsHydrated = useCouponsStore((s) => s.hydrated);
  const refreshCoupons = useCouponsStore((s) => s.refresh);

  const [period, setPeriod] = useState<FinancesPeriod>('month');
  const [tableFilter, setTableFilter] = useState<'all' | 'collected' | 'pending' | 'refunds' | 'cancelled'>('all');

  useEffect(() => {
    if (!reservationsHydrated) void refreshReservations();
    seedDemoReservationsIfEmpty();
  }, [reservationsHydrated, refreshReservations]);
  useEffect(() => {
    if (!extrasHydrated) void refreshExtras();
  }, [extrasHydrated, refreshExtras]);
  useEffect(() => {
    if (!couponsHydrated) void refreshCoupons();
  }, [couponsHydrated, refreshCoupons]);

  const range = useMemo(() => getPeriodRange(period), [period]);

  const dataReady = reservationsHydrated && extrasHydrated && couponsHydrated;

  const report = useMemo(() => {
    if (!dataReady) return null;
    return safeBuildFinancesReport(reservations, range, period, extrasCatalog, couponsCatalog, couponRedemptions);
  }, [couponRedemptions, couponsCatalog, dataReady, extrasCatalog, period, range, reservations]);

  const statusSegments: DonutSegment[] = useMemo(
    () =>
      report
        ? STATUS_ORDER.map((s) => ({
            id: s,
            label: statusLabel(s),
            value: report.byStatus[s],
            color: STATUS_COLORS[s],
          }))
        : [],
    [report],
  );

  const paymentSegments: DonutSegment[] = useMemo(
    () =>
      report
        ? PAYMENT_ORDER.map((k) => ({
            id: k,
            label: PAYMENT_METHOD_LABELS[k],
            value: report.byPaymentMethod[k],
            color: PAYMENT_METHOD_COLORS[k],
          }))
        : [],
    [report],
  );

  const compositionSegments: DonutSegment[] = useMemo(
    () =>
      report
        ? [
            { id: 'rental', label: 'Locations', value: report.rentalTotal, color: '#416B9F' },
            { id: 'extras', label: 'Extras', value: report.extrasTotal, color: '#7C3AED' },
          ]
        : [],
    [report],
  );

  const vatSegments: DonutSegment[] = useMemo(
    () =>
      report
        ? [
            { id: 'ht', label: 'HT', value: report.htTotal, color: '#64748B' },
            { id: 'tva', label: 'TVA', value: report.vatTotal, color: '#F59E0B' },
          ]
        : [],
    [report],
  );

  const filteredRows = useMemo(() => {
    if (!report) return [];
    if (tableFilter === 'all') return report.rows;
    if (tableFilter === 'collected') return report.rows.filter((r) => r.collected > 0);
    if (tableFilter === 'pending') return report.rows.filter((r) => r.pending > 0);
    if (tableFilter === 'refunds') return report.rows.filter((r) => r.refunds > 0);
    return report.rows.filter((r) => r.status === 'cancelled');
  }, [report, tableFilter]);

  if (!dataReady) {
    return (
      <div className="space-y-6">
        <FinancesPageSkeleton />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-6 rounded-2xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-bold text-zinc-900">Finances</h1>
        <p className="text-sm text-red-800">Impossible de générer le rapport financier. Rechargez la page.</p>
        <button
          type="button"
          onClick={() => {
            void refreshReservations();
            void refreshExtras();
            void refreshCoupons();
          }}
          className="rounded-xl bg-[#416B9F] px-4 py-2 text-sm font-semibold text-white"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Finances</h1>
            <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-zinc-500">
              Vue d&apos;ensemble du chiffre d&apos;affaires, des encaissements, remboursements, annulations, TVA et
              modes de paiement (en ligne, espèces, virement, prélèvement…).
            </p>
          </div>
          <p className="text-sm font-medium text-zinc-600">{report.rangeLabel}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['day', 'week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={[
                'rounded-xl px-4 py-2 text-sm font-semibold transition',
                period === p ? 'bg-[#416B9F] text-white shadow-sm' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/80',
              ].join(' ')}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="CA net"
            subtitle={`${report.pricedCount} location(s) tarifées · ${report.reservationCount} résa.`}
            amount={report.netRevenue}
            icon={<TrendingUp className="h-4 w-4" strokeWidth={2} />}
            tone="default"
          />
          <KpiCard
            title="Encaissé"
            subtitle="Paiements capturés (Stripe ou hors ligne validé)"
            amount={report.totalCollected}
            icon={<ArrowUpRight className="h-4 w-4" strokeWidth={2} />}
            tone="positive"
          />
          <KpiCard
            title="En attente"
            subtitle="Montants facturés non encore encaissés"
            amount={report.totalPending}
            icon={<CircleDollarSign className="h-4 w-4" strokeWidth={2} />}
            tone="warning"
          />
          <KpiCard
            title="Remboursements"
            subtitle={`${report.cancelledCount} annulation(s) · ${euro(report.cancelledAmount)} € perdu`}
            amount={report.totalRefunds}
            icon={<RotateCcw className="h-4 w-4" strokeWidth={2} />}
            tone="danger"
            badge={report.cancelledCount > 0 ? `${report.cancelledCount} annul.` : undefined}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            title="CA brut"
            subtitle="Avant remboursements (hors annulées)"
            amount={report.grossRevenue}
            icon={<Wallet className="h-4 w-4" strokeWidth={2} />}
            tone="neutral"
          />
          <KpiCard
            title="TVA estimée"
            subtitle={`HT ${euro(report.htTotal)} € · location TVA 20 % + extras`}
            amount={report.vatTotal}
            icon={<Receipt className="h-4 w-4" strokeWidth={2} />}
            tone="neutral"
          />
          <KpiCard
            title="Remises"
            subtitle={`Manuelles ${euro(report.discountTotal)} € · coupons ${euro(report.couponDiscountTotal)} €`}
            amount={report.discountTotal + report.couponDiscountTotal}
            icon={<ArrowDownRight className="h-4 w-4" strokeWidth={2} />}
            tone="neutral"
          />
        </div>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Évolution du CA net</h3>
              <p className="mt-0.5 text-xs text-zinc-500">Répartition dans le temps sur la période sélectionnée.</p>
            </div>
            <p className="text-lg font-bold tabular-nums text-[#416B9F]">{euro(report.netRevenue)} €</p>
          </div>
          <div className="mt-4">
            <MiniBarChart points={report.timeline} formatValue={(n) => euro(n)} />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartPanel title="Statuts des réservations" subtitle="Montants nets par statut (€)">
            <DonutChart
              segments={statusSegments}
              centerValue={`${euro(report.netRevenue)} €`}
              centerLabel="CA net"
            />
          </ChartPanel>

          <ChartPanel title="Modes de paiement" subtitle="Répartition des encaissements et attentes">
            <DonutChart
              segments={paymentSegments}
              centerValue={`${euro(report.totalCollected)} €`}
              centerLabel="Encaissé"
            />
          </ChartPanel>

          <ChartPanel title="Composition du CA" subtitle="Location vs extras (montants bruts)">
            <DonutChart
              segments={compositionSegments}
              centerValue={`${euro(report.rentalTotal + report.extrasTotal)} €`}
              centerLabel="Total"
            />
          </ChartPanel>

          <ChartPanel title="TVA & HT" subtitle="Estimation à partir des tarifs et TVA extras">
            <DonutChart
              segments={vatSegments}
              centerValue={`${euro(report.vatTotal)} €`}
              centerLabel="TVA"
            />
          </ChartPanel>
        </div>

        <section className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Journal des opérations</h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Détail par réservation — clique sur une ligne pour ouvrir le calendrier.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all' as const, label: 'Tout' },
                  { id: 'collected' as const, label: 'Encaissé' },
                  { id: 'pending' as const, label: 'En attente' },
                  { id: 'refunds' as const, label: 'Remboursements' },
                  { id: 'cancelled' as const, label: 'Annulations' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTableFilter(f.id)}
                  className={[
                    'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition',
                    tableFilter === f.id ? 'bg-[#416B9F] text-white' : 'bg-zinc-100 text-zinc-600',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3">Réservation</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Paiement</th>
                  <th className="px-4 py-3 text-right">Brut</th>
                  <th className="px-4 py-3 text-right">Remb.</th>
                  <th className="px-4 py-3 text-right">Net</th>
                  <th className="px-4 py-3 text-right">Encaissé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-500">
                      Aucune opération pour ce filtre sur la période.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const r = row.reservation;
                    const dateLabel = r.start.toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <tr key={r.id} className="hover:bg-zinc-50/80">
                        <td className="px-4 py-3">
                          <Link
                            to={`/calendrier?open=${encodeURIComponent(r.id)}`}
                            className="font-semibold text-[#416B9F] hover:underline"
                          >
                            {r.title}
                          </Link>
                          <p className="text-xs text-zinc-500">{dateLabel}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={[
                              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              statusBadgeClass(row.status, r.details),
                            ].join(' ')}
                          >
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700">
                            <PaymentIcon method={row.paymentMethod} />
                            {PAYMENT_METHOD_LABELS[row.paymentMethod]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-800">{euro(row.gross)} €</td>
                        <td className="px-4 py-3 text-right tabular-nums text-red-700">
                          {row.refunds > 0 ? `−${euro(row.refunds)} €` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-zinc-900">
                          {euro(row.net)} €
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                          {row.collected > 0 ? `${euro(row.collected)} €` : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-[#416B9F]/15 bg-gradient-to-br from-[#416B9F]/8 to-white p-4 text-sm text-zinc-600 sm:p-5">
          <div className="flex gap-3">
            <Landmark className="h-5 w-5 shrink-0 text-[#416B9F]" strokeWidth={1.75} />
            <div className="space-y-2">
              <p>
                <span className="font-semibold text-zinc-800">Modes hors ligne</span> (espèces, virement, prélèvement,
                chèque) sont déduits du champ « note de règlement » de la réservation. Précisez-le lors de la création
                pour une répartition fiable.
              </p>
              <p>
                <span className="font-semibold text-zinc-800">TVA</span> : 20 % sur la location, taux de chaque extra
                pour les options. Montants indicatifs — à rapprocher de votre comptabilité.
              </p>
              <p className="text-xs text-zinc-500">
                {report.pricedCount} réservation(s) avec tarif sur {report.reservationCount} dans la période.
              </p>
            </div>
          </div>
        </section>
      </div>
  );
}

function PaymentIcon({ method }: Readonly<{ method: PaymentMethodKey }>) {
  const cls = 'h-3.5 w-3.5 text-zinc-500';
  if (method === 'carte_en_ligne' || method === 'carte_hors_ligne') return <CreditCard className={cls} strokeWidth={2} />;
  if (method === 'espece') return <Banknote className={cls} strokeWidth={2} />;
  if (method === 'virement') return <Landmark className={cls} strokeWidth={2} />;
  if (method === 'prelevement') return <PiggyBank className={cls} strokeWidth={2} />;
  if (method === 'cheque') return <Receipt className={cls} strokeWidth={2} />;
  if (method === 'en_attente') return <CircleDollarSign className={cls} strokeWidth={2} />;
  if (method === 'hors_ligne_autre') return <Wallet className={cls} strokeWidth={2} />;
  return <Ban className={cls} strokeWidth={2} />;
}
