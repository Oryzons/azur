import { isSkipperExtra } from './payment-installments';

export type ExtraPriceKindInput = 'EURO' | 'PERCENT' | 'euro' | 'percent';
export type ExtraBillingUnitInput =
  | 'LOCATION'
  | 'JOUR'
  | 'SEMAINE'
  | 'location'
  | 'jour'
  | 'semaine';

export type ExtraLineForPricing = {
  quantity: number;
  extra: {
    priceKind: ExtraPriceKindInput;
    priceValue: number;
    billingUnit: ExtraBillingUnitInput;
  };
};

/** Libellé d'un extra sur contrat / facture (indique le règlement hors ligne). */
export function extraDocumentLabel(name: string, paymentChannel: string | null | undefined): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const offline = String(paymentChannel ?? '').toUpperCase() === 'OFFLINE';
  return offline ? `${trimmed} (hors ligne)` : trimmed;
}

/** Nombre de jours de location (aligné sur l’admin : créneau min. 1 jour). */
export function rentalDaysBetween(startAt: Date, endAt: Date): number {
  const start = startAt.getTime();
  let end = endAt.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  if (end <= start) end = start + 60 * 60 * 1000;
  return Math.max(1, Math.ceil((end - start) / 86400000));
}

export function billingUnitMultiplier(unit: ExtraBillingUnitInput, rentalDays: number): number {
  const u = String(unit).toUpperCase();
  if (u === 'JOUR') return rentalDays;
  if (u === 'SEMAINE') return Math.max(1, Math.ceil(rentalDays / 7));
  return 1;
}

/** Total TTC des extras en centimes (location + % du prix location, avec unité jour/semaine). */
export function computeExtrasTotalCents(
  rentalCents: number,
  extras: readonly ExtraLineForPricing[],
  rentalDays: number,
): number {
  let total = 0;
  for (const line of extras) {
    const ex = line.extra;
    const qty = line.quantity ?? 1;
    const mult = billingUnitMultiplier(ex.billingUnit, rentalDays);
    if (String(ex.priceKind).toUpperCase() === 'EURO') {
      total += Math.round(ex.priceValue * 100) * mult * qty;
    } else if (rentalCents > 0) {
      total += Math.round((rentalCents * ex.priceValue) / 100) * mult * qty;
    }
  }
  return total;
}

/** Montant TTC d’une seule ligne extra (centimes). */
/** Extra payé directement au prestataire (ex. skipper hors ligne) — hors CA base. */
export function isThirdPartyOfflineExtra(input: {
  name?: string | null;
  icon?: string | null;
  paymentChannel?: string | null;
}): boolean {
  const ch = String(input.paymentChannel ?? '').toLowerCase();
  return ch === 'offline' && isSkipperExtra(input);
}

export function computeExtraLineCents(
  rentalCents: number,
  line: ExtraLineForPricing,
  rentalDays: number,
): number {
  return computeExtrasTotalCents(rentalCents, [line], rentalDays);
}
