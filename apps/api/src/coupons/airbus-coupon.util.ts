import { normalizeAirbusBadge } from '@bleu-calanque/shared';

export function couponRequiresAirbusBadge(coupon: { requiresAirbusBadge: boolean; code: string }): boolean {
  return coupon.requiresAirbusBadge || coupon.code.toUpperCase().includes('AIRBUS');
}

export { normalizeAirbusBadge };
