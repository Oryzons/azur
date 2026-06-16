import { useCallback, useMemo } from 'react';
import type { Reservation } from '@/pages/calendar/reservationTypes';
import type { Coupon } from '@/stores/coupons';
import type { Extra } from '@/stores/extras';
import {
  getPeriodRange,
  safeBuildFinancesReport,
  type FinancesPeriod,
  type FinancesReport,
} from './financesAnalytics';

export type FinancesBlockId =
  | 'overview'
  | 'timeline'
  | 'status'
  | 'payment'
  | 'composition'
  | 'vat'
  | 'stripeFees'
  | 'stripeTimeline'
  | 'journal';

const BLOCK_IDS: FinancesBlockId[] = [
  'overview',
  'timeline',
  'status',
  'payment',
  'composition',
  'vat',
  'stripeFees',
  'stripeTimeline',
  'journal',
];

export function createDefaultBlockPeriods(): Record<FinancesBlockId, FinancesPeriod> {
  return Object.fromEntries(BLOCK_IDS.map((id) => [id, 'month' as FinancesPeriod])) as Record<
    FinancesBlockId,
    FinancesPeriod
  >;
}

export function createDefaultBlockAnchors(now = new Date()): Record<FinancesBlockId, Date> {
  return Object.fromEntries(BLOCK_IDS.map((id) => [id, new Date(now)])) as Record<FinancesBlockId, Date>;
}

export function useFinancesBlockReports(
  reservations: Reservation[],
  extrasCatalog: Extra[],
  couponsCatalog: Coupon[],
  blockPeriods: Record<FinancesBlockId, FinancesPeriod>,
  blockAnchors: Record<FinancesBlockId, Date>,
  dataReady: boolean,
) {
  const reportsByBlock = useMemo(() => {
    if (!dataReady) return null;
    const map = new Map<FinancesBlockId, FinancesReport>();
    for (const id of BLOCK_IDS) {
      const period = blockPeriods[id];
      const anchor = blockAnchors[id];
      const range = getPeriodRange(period, anchor);
      map.set(id, safeBuildFinancesReport(reservations, range, period, extrasCatalog, couponsCatalog));
    }
    return map;
  }, [blockAnchors, blockPeriods, couponsCatalog, dataReady, extrasCatalog, reservations]);

  const reportFor = useCallback(
    (blockId: FinancesBlockId): FinancesReport | null => {
      if (!reportsByBlock) return null;
      return reportsByBlock.get(blockId) ?? null;
    },
    [reportsByBlock],
  );

  return { reportsByBlock, reportFor };
}
