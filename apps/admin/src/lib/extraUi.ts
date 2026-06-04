import type { Extra, ExtraBillingUnit, ExtraPaymentChannel, ExtraPriceKind } from '@/stores/extras';
import { billingUnitLabel, formatExtraPriceLine } from '@/stores/extras';

export const EXTRA_BILLING_UNITS: ExtraBillingUnit[] = ['location', 'jour', 'semaine'];

export const EMPTY_EXTRA_TEMPLATE = {
  name: '',
  description: '',
  priceKind: 'euro' as ExtraPriceKind,
  priceValue: 20,
  billingUnit: 'location' as ExtraBillingUnit,
  vatRate: 20,
  stock: null as number | null,
  paymentChannel: 'online' as ExtraPaymentChannel,
  enabled: true,
};

export function paymentChannelLabel(p: ExtraPaymentChannel): string {
  return p === 'offline' ? 'Hors ligne' : 'En ligne';
}

export function vatLabel(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return `${v} %`;
}

export function stockLabel(s: number | null): string {
  if (s === null) return 'Illimité';
  return String(s);
}

export function priceKindLabel(k: ExtraPriceKind): string {
  return k === 'percent' ? 'Pourcentage' : 'Montant fixe';
}

export function extraSearchHaystack(ex: Extra): string {
  return [
    ex.name,
    ex.description,
    formatExtraPriceLine(ex),
    paymentChannelLabel(ex.paymentChannel),
    billingUnitLabel(ex.billingUnit),
  ]
    .join(' ')
    .toLowerCase();
}

export function extraInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}
