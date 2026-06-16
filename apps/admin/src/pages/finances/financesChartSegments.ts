import type { DonutSegment } from '@/components/charts/DonutChart';
import type { ReservationStatus } from '@/lib/reservationStatus';
import {
  PAYMENT_METHOD_COLORS,
  PAYMENT_METHOD_LABELS,
  STATUS_COLORS,
  type FinancesReport,
  type PaymentMethodKey,
} from './financesAnalytics';

const STATUS_ORDER: ReservationStatus[] = [
  'reserved_paid',
  'pending_payment',
  'partially_refunded',
  'refunded',
  'cancelled',
];

const STATUS_FINANCE_LABELS: Record<ReservationStatus, string> = {
  reserved_paid: 'Encaissé',
  pending_payment: 'En attente de paiement',
  partially_refunded: 'Remboursée partiellement',
  refunded: 'Remboursée',
  cancelled: 'Annulée',
};

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

export function statusSegmentsFromReport(report: FinancesReport): DonutSegment[] {
  return STATUS_ORDER.map((s) => ({
    id: s,
    label: STATUS_FINANCE_LABELS[s],
    value: report.byStatus[s],
    color: STATUS_COLORS[s],
  }));
}

export function paymentSegmentsFromReport(report: FinancesReport): DonutSegment[] {
  return PAYMENT_ORDER.map((k) => ({
    id: k,
    label: PAYMENT_METHOD_LABELS[k],
    value: report.byPaymentMethod[k],
    color: PAYMENT_METHOD_COLORS[k],
  }));
}

export function compositionSegmentsFromReport(report: FinancesReport): DonutSegment[] {
  return [
    { id: 'rental', label: 'Locations', value: report.rentalTotal, color: '#416B9F' },
    { id: 'extras', label: 'Extras', value: report.extrasTotal, color: '#7C3AED' },
  ];
}

export function vatSegmentsFromReport(report: FinancesReport): DonutSegment[] {
  return [
    { id: 'ht', label: 'HT', value: report.htTotal, color: '#64748B' },
    { id: 'tva', label: 'TVA', value: report.vatTotal, color: '#F59E0B' },
  ];
}

export function stripeSegmentsFromReport(report: FinancesReport): DonutSegment[] {
  return [
    {
      id: 'stripe_net',
      label: 'Net Stripe (banque)',
      value: report.totalStripeNet,
      color: '#16A34A',
    },
    {
      id: 'stripe_fees',
      label: 'Frais Stripe',
      value: report.totalStripeFees,
      color: '#DC2626',
    },
    {
      id: 'offline',
      label: 'Encaissé hors ligne',
      value: Math.max(0, report.totalCollected - report.totalStripeCollected),
      color: '#64748B',
    },
  ];
}
