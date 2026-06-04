export type CouponDiscountKindInput = 'PERCENT' | 'FIXED' | 'percent' | 'fixed';

export type CouponDiscountInput = {
  discountKind: CouponDiscountKindInput;
  /** Pourcentage 0–100 ou montant fixe en euros selon le kind. */
  discountValue: number;
};

/** Remise manuelle (%) sur location et extras. */
export function applyManualDiscountCents(
  rentalCents: number,
  extrasCents: number,
  discountPercent: number | null | undefined,
): { rentalCents: number; extrasCents: number } {
  const pct = discountPercent ?? 0;
  if (pct <= 0) return { rentalCents, extrasCents };
  const factor = (100 - pct) / 100;
  return {
    rentalCents: Math.round(rentalCents * factor),
    extrasCents: Math.round(extrasCents * factor),
  };
}

/**
 * Coupon partenaire (Airbus, etc.) : s’applique à la location uniquement, pas aux extras.
 * Les montants passés sont déjà après remise manuelle le cas échéant.
 */
export function applyCouponToRentalAndExtrasCents(
  rentalCents: number,
  extrasCents: number,
  coupon: CouponDiscountInput | null | undefined,
): { rentalCents: number; extrasCents: number; totalCents: number } {
  const extras = extrasCents;
  if (!coupon) {
    return { rentalCents, extrasCents: extras, totalCents: rentalCents + extras };
  }
  let rental = rentalCents;
  const kind = String(coupon.discountKind).toUpperCase();
  if (kind === 'PERCENT') {
    rental = Math.round((rental * (100 - coupon.discountValue)) / 100);
  } else {
    rental = Math.max(0, rental - Math.round(coupon.discountValue * 100));
  }
  return { rentalCents: rental, extrasCents: extras, totalCents: rental + extras };
}

export function computeReservationTotalCentsWithDiscounts(
  rentalCents: number,
  extrasCents: number,
  discountPercent: number | null | undefined,
  coupon: CouponDiscountInput | null | undefined,
): number {
  const afterManual = applyManualDiscountCents(rentalCents, extrasCents, discountPercent);
  return applyCouponToRentalAndExtrasCents(
    afterManual.rentalCents,
    afterManual.extrasCents,
    coupon,
  ).totalCents;
}

/** Variante euros (admin) — coupon sur la location uniquement. */
export function applyCouponToRentalAndExtrasEuros(
  locationAfterManual: number,
  extrasAfterManual: number,
  coupon: CouponDiscountInput | null | undefined,
): { locationNet: number; extrasNet: number; final: number } {
  const extrasNet = extrasAfterManual;
  if (!coupon) {
    const final = Math.round((locationAfterManual + extrasAfterManual) * 100) / 100;
    return { locationNet: locationAfterManual, extrasNet, final };
  }
  let locationNet = locationAfterManual;
  const kind = String(coupon.discountKind).toLowerCase();
  if (kind === 'percent') {
    locationNet = Math.round(locationAfterManual * (1 - coupon.discountValue / 100) * 100) / 100;
  } else {
    locationNet = Math.max(0, Math.round((locationAfterManual - coupon.discountValue) * 100) / 100);
  }
  const final = Math.round((locationNet + extrasNet) * 100) / 100;
  return { locationNet, extrasNet, final };
}
