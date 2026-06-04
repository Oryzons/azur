import type { Coupon, CouponDiscountKind } from '@/stores/coupons';
import { isCouponActiveNow } from '@/stores/coupons';

export const CREATE_COUPON_ID = '__new__';

export function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function inputCls() {
  return 'mt-1.5 w-full rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-[#416B9F]/60 focus:ring-2 focus:ring-[#416B9F]/15';
}

export function formatDiscountLine(c: Pick<Coupon, 'discountKind' | 'discountValue'>) {
  if (c.discountKind === 'fixed') {
    const v = c.discountValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `−${v} €`;
  }
  return `−${c.discountValue} %`;
}

export function formatDegradedValue(c: Pick<Coupon, 'discountKind'>, value: number) {
  if (c.discountKind === 'fixed') {
    return `−${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  }
  return `−${value} %`;
}

export function formatSeasonRuleLine(c: Coupon) {
  const r = c.seasonRule;
  if (!r) return null;
  return `Saison avr.–sept. : ${r.maxFullDiscountUsesPerClient} utilisation(s) pleine remise / client, puis ${formatDegradedValue(c, r.degradedDiscountValue)}`;
}

export function formatRange(c: Pick<Coupon, 'validFrom' | 'validUntil'>) {
  const from = c.validFrom?.trim();
  const until = c.validUntil?.trim();
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  if (!from) return '—';
  const a = new Date(`${from}T12:00:00`).toLocaleDateString('fr-FR', opts);
  if (!until) return `À partir du ${a}`;
  const b = new Date(`${until}T12:00:00`).toLocaleDateString('fr-FR', opts);
  return `Du ${a} au ${b}`;
}

export function couponSearchHaystack(c: Coupon) {
  return [c.code, c.internalLabel, formatDiscountLine(c), formatRange(c)].join(' ').toLowerCase();
}

export type CouponListStatus = 'active' | 'disabled' | 'out_of_range' | 'scheduled';

export function couponListStatus(c: Coupon): CouponListStatus {
  if (!c.enabled) return 'disabled';
  if (!c.validFrom?.trim()) return 'disabled';
  const now = new Date();
  const t = now.getTime();
  const from = new Date(`${c.validFrom.trim()}T00:00:00.000`).getTime();
  if (t < from) return 'scheduled';
  if (c.validUntil?.trim()) {
    const until = new Date(`${c.validUntil.trim()}T23:59:59.999`).getTime();
    if (t > until) return 'out_of_range';
  }
  return isCouponActiveNow(c, now) ? 'active' : 'out_of_range';
}

export function discountKindLabel(k: CouponDiscountKind) {
  return k === 'fixed' ? 'Montant fixe' : 'Pourcentage';
}

export function parseDiscountValue(raw: string): number {
  return Number.parseFloat(String(raw).replaceAll(',', '.'));
}

export function normalizeForSearch(s: string): string {
  return s
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
