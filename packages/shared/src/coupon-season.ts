/** Saison avril–septembre pour les paliers de coupons partenaires. */
export function isDateInAprilSeptemberSeason(d: Date): boolean {
  const m = d.getMonth();
  return m >= 3 && m <= 8;
}

export function seasonYearForAprilSeptember(d: Date): number | null {
  if (!isDateInAprilSeptemberSeason(d)) return null;
  return d.getFullYear();
}

export type CouponRedemptionLike = {
  clientKey: string;
  redeemedAt: Date | string;
};

/** Utilisations antérieures à `evaluationDate` pour le même client et la même saison. */
export function countPriorSeasonCouponUses(
  redemptions: readonly CouponRedemptionLike[],
  clientKey: string,
  evaluationDate: Date,
): number {
  const seasonY = seasonYearForAprilSeptember(evaluationDate);
  if (seasonY === null) return 0;
  const key = clientKey.trim();
  const keyLower = key.toLowerCase();
  const evalMs = evaluationDate.getTime();
  return redemptions.filter((r) => {
    const redeemed = r.redeemedAt instanceof Date ? r.redeemedAt : new Date(r.redeemedAt);
    if (Number.isNaN(redeemed.getTime()) || redeemed.getTime() >= evalMs) return false;
    if (seasonYearForAprilSeptember(redeemed) !== seasonY) return false;
    const rk = r.clientKey.trim();
    return rk === key || rk.toLowerCase() === keyLower;
  }).length;
}
