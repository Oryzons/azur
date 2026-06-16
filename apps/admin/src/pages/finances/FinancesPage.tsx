import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
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
import { DonutChart } from '@/components/charts/DonutChart';
import { MiniBarChart } from '@/components/charts/MiniBarChart';
import { FinancesPageSkeleton } from '@/components/skeletons/FinancesPageSkeleton';
import { statusBadgeClass, statusDisplayLabel } from '@/lib/reservationStatus';
import { api } from '@/lib/api';
import { deserializeReservation, seedDemoReservationsIfEmpty, useReservationsStore } from '@/stores/reservations';
import { useExtrasStore } from '@/stores/extras';
import { useCouponsStore } from '@/stores/coupons';
import { euro } from './pricingTotals';
import { PAYMENT_METHOD_LABELS, type FinancesPeriod, type PaymentMethodKey } from './financesAnalytics';
import {
  createDefaultBlockAnchors,
  createDefaultBlockPeriods,
  useFinancesBlockReports,
  type FinancesBlockId,
} from './financesBlockReports';
import {
  compositionSegmentsFromReport,
  paymentSegmentsFromReport,
  statusSegmentsFromReport,
  stripeSegmentsFromReport,
  vatSegmentsFromReport,
} from './financesChartSegments';
import { PeriodControls, RevenueModePicker, type RevenueDisplayMode } from './PeriodBubblePicker';
import { financesPeriodAnimKey, type FinancesReport } from './financesAnalytics';
import { stripeFeeEstimateTierLabel } from '@bleu-calanque/shared';
import { StripeLiveBalanceCard } from './StripeLiveBalanceCard';

const JOURNAL_PAGE_SIZE = 10;

function AnimatedBlockBody(props: Readonly<{ periodKey: string; children: ReactNode }>) {
  return (
    <div key={props.periodKey} className="bc-finances-block-enter">
      {props.children}
    </div>
  );
}

function RevenueKpiCard(
  props: Readonly<{
    report: FinancesReport;
    mode: RevenueDisplayMode;
    onModeChange: (mode: RevenueDisplayMode) => void;
  }>,
) {
  const { report, mode, onModeChange } = props;
  const isNet = mode === 'net';
  const amount = isNet ? report.netRevenue : report.grossRevenue;
  const subtitle = isNet
    ? `${report.pricedCount} location(s) tarifées · ${report.reservationCount} résa.`
    : 'Avant remboursements (hors annulées)';

  return (
    <div className="rounded-2xl border border-[#416B9F]/20 bg-gradient-to-br from-[#416B9F]/6 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-[#416B9F] shadow-sm ring-1 ring-zinc-200/80">
          <TrendingUp className="h-4 w-4" strokeWidth={2} />
        </div>
        <RevenueModePicker value={mode} onChange={onModeChange} aria-label="CA net ou brut" />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        CA {isNet ? 'net' : 'brut'}
      </p>
      <AnimatedBlockBody periodKey={mode}>
        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-zinc-900">
          <AnimatedNumber value={amount} format={(n) => `${euro(n)} €`} />
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">{subtitle}</p>
      </AnimatedBlockBody>
    </div>
  );
}

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

function ChartPanel(
  props: Readonly<{
    title: string;
    subtitle: string;
    rangeLabel?: string;
    period: FinancesPeriod;
    anchor: Date;
    onPeriodChange: (period: FinancesPeriod) => void;
    onAnchorChange: (anchor: Date) => void;
    children: ReactNode;
  }>,
) {
  const { title, subtitle, rangeLabel, period, anchor, onPeriodChange, onAnchorChange, children } = props;
  const animKey = financesPeriodAnimKey(period, anchor);
  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
          {rangeLabel ? (
            <p className="mt-1 text-[10px] font-medium text-[#416B9F]/80">{rangeLabel}</p>
          ) : null}
        </div>
        <PeriodControls
          period={period}
          anchor={anchor}
          onPeriodChange={onPeriodChange}
          onAnchorChange={onAnchorChange}
          compact
          aria-label={`Période — ${title}`}
        />
      </div>
      <div className="mt-4">
        <AnimatedBlockBody periodKey={animKey}>{children}</AnimatedBlockBody>
      </div>
    </section>
  );
}

export function FinancesPage() {
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

  const [blockPeriods, setBlockPeriods] = useState(createDefaultBlockPeriods);
  const [blockAnchors, setBlockAnchors] = useState(createDefaultBlockAnchors);
  const [revenueMode, setRevenueMode] = useState<RevenueDisplayMode>('net');
  const [tableFilter, setTableFilter] = useState<'all' | 'collected' | 'pending' | 'refunds' | 'cancelled'>('all');
  const [journalVisibleCount, setJournalVisibleCount] = useState(JOURNAL_PAGE_SIZE);
  const stripeFeesSynced = useRef(false);

  const setBlockPeriod = (blockId: FinancesBlockId, period: FinancesPeriod) => {
    setBlockPeriods((prev) => ({ ...prev, [blockId]: period }));
    setBlockAnchors((prev) => ({ ...prev, [blockId]: new Date() }));
  };

  const setBlockAnchor = (blockId: FinancesBlockId, anchor: Date) => {
    setBlockAnchors((prev) => ({ ...prev, [blockId]: anchor }));
  };

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

  useEffect(() => {
    if (!reservationsHydrated || stripeFeesSynced.current) return;
    stripeFeesSynced.current = true;
    void api.post('/reservations/sync-stripe-fees').then(() => refreshReservations()).catch(() => {});
  }, [reservationsHydrated, refreshReservations]);

  const dataReady = reservationsHydrated && extrasHydrated && couponsHydrated;

  const { reportFor } = useFinancesBlockReports(
    reservations,
    extrasCatalog,
    couponsCatalog,
    blockPeriods,
    blockAnchors,
    dataReady,
  );

  const overviewReport = reportFor('overview');
  const timelineReport = reportFor('timeline');
  const statusReport = reportFor('status');
  const paymentReport = reportFor('payment');
  const compositionReport = reportFor('composition');
  const vatReport = reportFor('vat');
  const stripeFeesReport = reportFor('stripeFees');
  const stripeTimelineReport = reportFor('stripeTimeline');
  const journalReport = reportFor('journal');

  const filteredRows = useMemo(() => {
    if (!journalReport) return [];
    if (tableFilter === 'all') return journalReport.rows;
    if (tableFilter === 'collected') return journalReport.rows.filter((r) => r.collected > 0);
    if (tableFilter === 'pending') return journalReport.rows.filter((r) => r.pending > 0);
    if (tableFilter === 'refunds') return journalReport.rows.filter((r) => r.refunds > 0);
    return journalReport.rows.filter((r) => r.status === 'cancelled');
  }, [journalReport, tableFilter]);

  const visibleJournalRows = useMemo(
    () => filteredRows.slice(0, journalVisibleCount),
    [filteredRows, journalVisibleCount],
  );
  const journalHasMore = filteredRows.length > journalVisibleCount;

  useEffect(() => {
    setJournalVisibleCount(JOURNAL_PAGE_SIZE);
  }, [blockPeriods.journal, blockAnchors.journal, tableFilter]);

  if (!dataReady) {
    return (
      <div className="space-y-6">
        <FinancesPageSkeleton />
      </div>
    );
  }

  if (!overviewReport) {
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
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Finances</h1>
            <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-zinc-500">
              Vue d&apos;ensemble du chiffre d&apos;affaires, des encaissements, remboursements, annulations, TVA et
              modes de paiement (en ligne, espèces, virement, prélèvement…).
            </p>
          </div>
          <p className="text-sm font-medium text-zinc-600">{overviewReport.rangeLabel}</p>
        </div>

        <div className="space-y-6">
        <PeriodControls
          period={blockPeriods.overview}
          anchor={blockAnchors.overview}
          onPeriodChange={(p) => setBlockPeriod('overview', p)}
          onAnchorChange={(a) => setBlockAnchor('overview', a)}
          aria-label="Période — indicateurs"
        />

        <AnimatedBlockBody periodKey={financesPeriodAnimKey(blockPeriods.overview, blockAnchors.overview)}>
        <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RevenueKpiCard report={overviewReport} mode={revenueMode} onModeChange={setRevenueMode} />
          <KpiCard
            title="Encaissé"
            subtitle="Paiements capturés (Stripe ou hors ligne validé)"
            amount={overviewReport.totalCollected}
            icon={<ArrowUpRight className="h-4 w-4" strokeWidth={2} />}
            tone="positive"
          />
          <KpiCard
            title="En attente"
            subtitle="Montants facturés non encore encaissés"
            amount={overviewReport.totalPending}
            icon={<CircleDollarSign className="h-4 w-4" strokeWidth={2} />}
            tone="warning"
          />
          <KpiCard
            title="Remboursements"
            subtitle={`${overviewReport.cancelledCount} annulation(s) · ${euro(overviewReport.cancelledAmount)} € perdu`}
            amount={overviewReport.totalRefunds}
            icon={<RotateCcw className="h-4 w-4" strokeWidth={2} />}
            tone="danger"
            badge={overviewReport.cancelledCount > 0 ? `${overviewReport.cancelledCount} annul.` : undefined}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            title="Frais Stripe"
            subtitle={
              overviewReport.stripeFeesEstimated
                ? `Estimation ${stripeFeeEstimateTierLabel('eee_standard')} — sync. Stripe au chargement`
                : 'Frais réels Stripe (balance_transaction)'
            }
            amount={overviewReport.totalStripeFees}
            icon={<CreditCard className="h-4 w-4" strokeWidth={2} />}
            tone="danger"
            badge={
              overviewReport.stripeEffectiveFeePercent != null
                ? `${overviewReport.stripeEffectiveFeePercent.toFixed(2).replace('.', ',')} %`
                : undefined
            }
          />
          <KpiCard
            title="Net en banque"
            subtitle="Encaissements − frais Stripe (hors ligne inclus)"
            amount={overviewReport.totalNetInBank}
            icon={<PiggyBank className="h-4 w-4" strokeWidth={2} />}
            tone="positive"
          />
          <KpiCard
            title="CB Stripe encaissée"
            subtitle="Part des encaissements passée par Stripe"
            amount={overviewReport.totalStripeCollected}
            icon={<Banknote className="h-4 w-4" strokeWidth={2} />}
            tone="neutral"
          />
          <KpiCard
            title="Net Stripe"
            subtitle={`Calcul période (${overviewReport.rangeLabel}) — voir solde live ci-dessous`}
            amount={overviewReport.totalStripeNet}
            icon={<Wallet className="h-4 w-4" strokeWidth={2} />}
            tone="default"
          />
          <KpiCard
            title="TVA estimée"
            subtitle={`HT ${euro(overviewReport.htTotal)} € · location TVA 20 % + extras`}
            amount={overviewReport.vatTotal}
            icon={<Receipt className="h-4 w-4" strokeWidth={2} />}
            tone="neutral"
          />
        </div>
        </div>
        </AnimatedBlockBody>

        <StripeLiveBalanceCard
          periodNetStripe={overviewReport.totalStripeNet}
          periodStripeGross={overviewReport.totalStripeCollected}
          periodLabel={overviewReport.rangeLabel}
          feesEstimated={overviewReport.stripeFeesEstimated}
        />
        </div>

        <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-zinc-900">Évolution du CA net</h3>
              <p className="mt-0.5 text-xs text-zinc-500">Répartition dans le temps sur la période sélectionnée.</p>
              {timelineReport ? (
                <p className="mt-1 text-[10px] font-medium text-[#416B9F]/80">{timelineReport.rangeLabel}</p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-2">
              <PeriodControls
                period={blockPeriods.timeline}
                anchor={blockAnchors.timeline}
                onPeriodChange={(p) => setBlockPeriod('timeline', p)}
                onAnchorChange={(a) => setBlockAnchor('timeline', a)}
                compact
                aria-label="Période — évolution du CA"
              />
              {timelineReport ? (
                <p className="text-lg font-bold tabular-nums text-[#416B9F]">
                  <AnimatedNumber value={timelineReport.netRevenue} format={(n) => `${euro(n)} €`} />
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-4">
            {timelineReport ? (
              <AnimatedBlockBody periodKey={financesPeriodAnimKey(blockPeriods.timeline, blockAnchors.timeline)}>
                <MiniBarChart points={timelineReport.timeline} formatValue={(n) => euro(n)} />
              </AnimatedBlockBody>
            ) : null}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {statusReport ? (
            <ChartPanel
              title="Statuts des réservations"
              subtitle="Encaissé et en attente par statut (€)"
              rangeLabel={statusReport.rangeLabel}
              period={blockPeriods.status}
              anchor={blockAnchors.status}
              onPeriodChange={(p) => setBlockPeriod('status', p)}
              onAnchorChange={(a) => setBlockAnchor('status', a)}
            >
              <DonutChart
                animKey={financesPeriodAnimKey(blockPeriods.status, blockAnchors.status)}
                segments={statusSegmentsFromReport(statusReport)}
                centerAmount={statusReport.totalCollected + statusReport.totalPending}
                centerLabel="CA net"
              />
            </ChartPanel>
          ) : null}

          {paymentReport ? (
            <ChartPanel
              title="Modes de paiement"
              subtitle="Par échéance : CB en ligne, espèces, chèque… et montants encore à encaisser"
              rangeLabel={paymentReport.rangeLabel}
              period={blockPeriods.payment}
              anchor={blockAnchors.payment}
              onPeriodChange={(p) => setBlockPeriod('payment', p)}
              onAnchorChange={(a) => setBlockAnchor('payment', a)}
            >
              <DonutChart
                animKey={financesPeriodAnimKey(blockPeriods.payment, blockAnchors.payment)}
                segments={paymentSegmentsFromReport(paymentReport)}
                centerAmount={paymentReport.totalCollected}
                centerLabel="Encaissé"
              />
            </ChartPanel>
          ) : null}

          {compositionReport ? (
            <ChartPanel
              title="Composition du CA"
              subtitle="Location vs extras (montants bruts)"
              rangeLabel={compositionReport.rangeLabel}
              period={blockPeriods.composition}
              anchor={blockAnchors.composition}
              onPeriodChange={(p) => setBlockPeriod('composition', p)}
              onAnchorChange={(a) => setBlockAnchor('composition', a)}
            >
              <DonutChart
                animKey={financesPeriodAnimKey(blockPeriods.composition, blockAnchors.composition)}
                segments={compositionSegmentsFromReport(compositionReport)}
                centerAmount={compositionReport.rentalTotal + compositionReport.extrasTotal}
                centerLabel="Total"
              />
            </ChartPanel>
          ) : null}

          {vatReport ? (
            <ChartPanel
              title="TVA & HT"
              subtitle="Estimation à partir des tarifs et TVA extras"
              rangeLabel={vatReport.rangeLabel}
              period={blockPeriods.vat}
              anchor={blockAnchors.vat}
              onPeriodChange={(p) => setBlockPeriod('vat', p)}
              onAnchorChange={(a) => setBlockAnchor('vat', a)}
            >
              <DonutChart
                animKey={financesPeriodAnimKey(blockPeriods.vat, blockAnchors.vat)}
                segments={vatSegmentsFromReport(vatReport)}
                centerAmount={vatReport.vatTotal}
                centerLabel="TVA"
              />
            </ChartPanel>
          ) : null}

          {stripeFeesReport ? (
            <ChartPanel
              title="Frais Stripe"
              subtitle={
                stripeFeesReport.stripeFeesEstimated
                  ? 'Frais estimés tant que Stripe n’a pas été synchronisé'
                  : 'Répartition net Stripe, frais et encaissements hors ligne'
              }
              rangeLabel={stripeFeesReport.rangeLabel}
              period={blockPeriods.stripeFees}
              anchor={blockAnchors.stripeFees}
              onPeriodChange={(p) => setBlockPeriod('stripeFees', p)}
              onAnchorChange={(a) => setBlockAnchor('stripeFees', a)}
            >
              <DonutChart
                animKey={financesPeriodAnimKey(blockPeriods.stripeFees, blockAnchors.stripeFees)}
                segments={stripeSegmentsFromReport(stripeFeesReport)}
                centerAmount={stripeFeesReport.totalNetInBank}
                centerLabel="Net banque"
              />
            </ChartPanel>
          ) : null}

          {stripeTimelineReport ? (
            <ChartPanel
              title="Évolution frais Stripe"
              subtitle="Frais et net crédité par créneau"
              rangeLabel={stripeTimelineReport.rangeLabel}
              period={blockPeriods.stripeTimeline}
              anchor={blockAnchors.stripeTimeline}
              onPeriodChange={(p) => setBlockPeriod('stripeTimeline', p)}
              onAnchorChange={(a) => setBlockAnchor('stripeTimeline', a)}
            >
              <div className="space-y-3">
                <MiniBarChart
                  points={stripeTimelineReport.stripeTimeline.map((p) => ({ label: p.label, value: p.fees }))}
                  formatValue={(n) => euro(n)}
                />
                <p className="text-center text-[11px] font-medium text-zinc-500">Frais Stripe (€)</p>
                <MiniBarChart
                  points={stripeTimelineReport.stripeTimeline.map((p) => ({ label: p.label, value: p.net }))}
                  formatValue={(n) => euro(n)}
                />
                <p className="text-center text-[11px] font-medium text-zinc-500">Net crédité Stripe (€)</p>
              </div>
            </ChartPanel>
          ) : null}
        </div>

        <section className="rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-zinc-900">Journal des opérations</h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Détail par réservation — clique sur une ligne pour ouvrir le calendrier.
              </p>
              {journalReport ? (
                <p className="mt-1 text-[10px] font-medium text-[#416B9F]/80">{journalReport.rangeLabel}</p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-2 sm:items-center sm:flex-row sm:flex-wrap">
              <PeriodControls
                period={blockPeriods.journal}
                anchor={blockAnchors.journal}
                onPeriodChange={(p) => setBlockPeriod('journal', p)}
                onAnchorChange={(a) => setBlockAnchor('journal', a)}
                compact
                aria-label="Période — journal"
              />
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
          </div>

          <AnimatedBlockBody periodKey={financesPeriodAnimKey(blockPeriods.journal, blockAnchors.journal)}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="px-4 py-3">Réservation</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Paiement</th>
                  <th className="px-4 py-3 text-right">Brut</th>
                  <th className="px-4 py-3 text-right">Remb.</th>
                  <th className="px-4 py-3 text-right">Net</th>
                  <th className="px-4 py-3 text-right">Encaissé</th>
                  <th className="px-4 py-3 text-right">Frais Stripe</th>
                  <th className="px-4 py-3 text-right">Net banque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-zinc-500">
                      Aucune opération pour ce filtre sur la période.
                    </td>
                  </tr>
                ) : (
                  visibleJournalRows.map((row) => {
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
                              statusBadgeClass(row.status, r.details, { installmentPlan: r.installmentPlan }),
                            ].join(' ')}
                          >
                            {statusDisplayLabel(row.status, r.details, { installmentPlan: r.installmentPlan })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <PaymentMethodsCell
                            collectedByMethod={row.collectedByMethod}
                            pendingByMethod={row.pendingByMethod}
                            fallbackMethod={row.paymentMethod}
                          />
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
                        <td className="px-4 py-3 text-right tabular-nums text-red-700">
                          {row.stripeFee > 0 ? (
                            <span title={row.stripeFeeEstimated ? 'Frais estimés' : 'Frais Stripe réels'}>
                              {row.stripeFeeEstimated ? '~' : ''}
                              {euro(row.stripeFee)} €
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-[#416B9F]">
                          {row.netInBank > 0 ? `${euro(row.netInBank)} €` : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredRows.length > 0 ? (
            <div className="flex flex-col items-center gap-2 border-t border-zinc-100 px-4 py-4 sm:flex-row sm:justify-between sm:px-5">
              <p className="text-xs text-zinc-500">
                {visibleJournalRows.length} sur {filteredRows.length} opération
                {filteredRows.length > 1 ? 's' : ''}
              </p>
              {journalHasMore ? (
                <button
                  type="button"
                  onClick={() => setJournalVisibleCount((n) => n + JOURNAL_PAGE_SIZE)}
                  className="min-h-[2.5rem] rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-200/90 active:scale-[0.98]"
                >
                  Voir + ({Math.min(JOURNAL_PAGE_SIZE, filteredRows.length - journalVisibleCount)} de plus)
                </button>
              ) : filteredRows.length > JOURNAL_PAGE_SIZE ? (
                <button
                  type="button"
                  onClick={() => setJournalVisibleCount(JOURNAL_PAGE_SIZE)}
                  className="min-h-[2.5rem] rounded-xl px-4 py-2 text-sm font-semibold text-[#416B9F] transition hover:bg-[#416B9F]/8"
                >
                  Réduire
                </button>
              ) : null}
            </div>
          ) : null}
          </AnimatedBlockBody>
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
                <span className="font-semibold text-zinc-800">Stripe</span> : le bloc « Solde Stripe (temps réel) »
                reprend le disponible + en attente du dashboard Stripe. Les indicateurs « Net Stripe » et « CB Stripe
                encaissée » sont calculés depuis vos réservations sur la période choisie (date de location), avec frais
                réels quand synchronisés, sinon estimation EEE ({stripeFeeEstimateTierLabel('eee_standard')}).
              </p>
              <p>
                <span className="font-semibold text-zinc-800">TVA</span> : 20 % sur la location, taux de chaque extra
                pour les options. Montants indicatifs — à rapprocher de votre comptabilité.
              </p>
              <p className="text-xs text-zinc-500">
                {overviewReport.pricedCount} réservation(s) avec tarif sur {overviewReport.reservationCount} dans la période des indicateurs.
              </p>
            </div>
          </div>
        </section>
      </div>
  );
}

function PaymentMethodsCell(
  props: Readonly<{
    collectedByMethod: Partial<Record<PaymentMethodKey, number>>;
    pendingByMethod: Partial<Record<PaymentMethodKey, number>>;
    fallbackMethod: PaymentMethodKey;
  }>,
) {
  const { collectedByMethod, pendingByMethod, fallbackMethod } = props;
  const lines: { method: PaymentMethodKey; label: string; tone: 'collected' | 'pending' }[] = [];

  for (const [method, amount] of Object.entries(collectedByMethod) as [PaymentMethodKey, number][]) {
    if (amount > 0) {
      lines.push({
        method,
        label: `${PAYMENT_METHOD_LABELS[method]} · ${euro(amount)} €`,
        tone: 'collected',
      });
    }
  }
  for (const [method, amount] of Object.entries(pendingByMethod) as [PaymentMethodKey, number][]) {
    if (amount <= 0) continue;
    lines.push({
      method,
      label:
        method === 'en_attente'
          ? `En attente · ${euro(amount)} €`
          : `${PAYMENT_METHOD_LABELS[method]} (à encaisser) · ${euro(amount)} €`,
      tone: 'pending',
    });
  }

  if (lines.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700">
        <PaymentIcon method={fallbackMethod} />
        {PAYMENT_METHOD_LABELS[fallbackMethod]}
      </span>
    );
  }

  return (
    <ul className="space-y-1 text-xs font-medium text-zinc-700">
      {lines.map((line) => (
        <li key={`${line.method}-${line.tone}-${line.label}`} className="inline-flex items-center gap-1.5">
          <PaymentIcon method={line.method} />
          <span className={line.tone === 'pending' ? 'text-amber-800' : undefined}>{line.label}</span>
        </li>
      ))}
    </ul>
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
