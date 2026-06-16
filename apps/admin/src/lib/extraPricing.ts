import type { Extra, ExtraBillingUnit } from '@/stores/extras';

export function rentalDaysBetweenDates(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 1;
  return Math.max(1, Math.ceil(ms / 86400000));
}

export function extraUnitMultiplier(unit: ExtraBillingUnit, rentalDays: number): number {
  if (unit === 'location') return 1;
  if (unit === 'jour') return rentalDays;
  return Math.max(1, Math.ceil(rentalDays / 7));
}

/** Montant TTC d'une liste d'extras (€), hors remises. */
export function sumExtrasEuros(rentalEuros: number, extras: readonly Extra[], rentalDays: number): number {
  const euro = extras
    .filter((e) => e.priceKind === 'euro')
    .reduce((sum, e) => sum + e.priceValue * extraUnitMultiplier(e.billingUnit, rentalDays), 0);
  const percent = extras
    .filter((e) => e.priceKind === 'percent')
    .reduce(
      (sum, e) => sum + rentalEuros * (e.priceValue / 100) * extraUnitMultiplier(e.billingUnit, rentalDays),
      0,
    );
  return Math.round((euro + percent) * 100) / 100;
}

export function splitExtrasByPaymentChannel(extras: readonly Extra[]) {
  const online: Extra[] = [];
  const offline: Extra[] = [];
  for (const e of extras) {
    if (e.paymentChannel === 'offline') offline.push(e);
    else online.push(e);
  }
  return { online, offline };
}
