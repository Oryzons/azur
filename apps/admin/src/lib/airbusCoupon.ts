import type { Coupon } from '@/stores/coupons';

export function couponRequiresAirbusBadge(c: Pick<Coupon, 'requiresAirbusBadge' | 'code'>): boolean {
  return Boolean(c.requiresAirbusBadge) || c.code.toUpperCase().includes('AIRBUS');
}

export function isAirbusCouponCode(code: string): boolean {
  return code.trim().toUpperCase().includes('AIRBUS');
}
