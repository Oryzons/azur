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
  icon: null as string | null,
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
  return `${s} / jour`;
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

/** Libellé court d'unité de facturation (bulle UI). */
export function extraBillingUnitShort(u: ExtraBillingUnit): string {
  if (u === 'location') return '/Loc';
  if (u === 'jour') return '/J';
  return '/Sem';
}

/**
 * Nom affiché dans le wizard : le skipper « journée » sans qualificatif
 * devient « Skipper — journée complète » pour le distinguer de la demi-journée.
 */
export function extraDisplayName(name: string): string {
  const n = name.trim();
  if (/^skipper$/i.test(n)) return 'Skipper — journée complète';
  return n;
}

/** Montant seul pour la bulle prix (sans unité). */
export function formatExtraPriceAmount(ex: Pick<Extra, 'priceKind' | 'priceValue'>): string {
  if (ex.priceKind === 'percent') return `${ex.priceValue} %`;
  return ex.priceValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
