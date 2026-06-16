/**
 * Grille Stripe Payments (France / EEE) — estimation si balance_transaction absente.
 * @see https://stripe.com/fr/pricing
 */
export const STRIPE_FEE_EEE_STANDARD = { percent: 1.5, fixedCents: 25 } as const;
export const STRIPE_FEE_EEE_PREMIUM = { percent: 1.9, fixedCents: 25 } as const;
export const STRIPE_FEE_UK_CARD = { percent: 2.5, fixedCents: 25 } as const;
export const STRIPE_FEE_INTERNATIONAL_CARD = { percent: 3.25, fixedCents: 25 } as const;
/** Majoration conversion de devises (cartes internationales / UK). */
export const STRIPE_FEE_CURRENCY_CONVERSION_PERCENT = 2;
/** Prélèvement SEPA — forfait par transaction. */
export const STRIPE_FEE_SEPA_DEBIT_FIXED_CENTS = 35;

/** Estimation par défaut : carte standard EEE (1,5 % + 0,25 €). */
export const DEFAULT_STRIPE_FEE_PERCENT = STRIPE_FEE_EEE_STANDARD.percent;
export const DEFAULT_STRIPE_FEE_FIXED_CENTS = STRIPE_FEE_EEE_STANDARD.fixedCents;

export type StripeFeeEstimateTier =
  | 'eee_standard'
  | 'eee_premium'
  | 'uk'
  | 'international'
  | 'sepa_debit';

export type StripeFeeEstimateConfig = {
  percent?: number;
  fixedCents?: number;
  /** Palier carte (défaut : standard EEE). */
  tier?: StripeFeeEstimateTier;
  /** Inclure +2 % conversion devises (cartes UK / internationales). */
  currencyConversion?: boolean;
};

function tierDefaults(tier: StripeFeeEstimateTier): { percent: number; fixedCents: number } {
  switch (tier) {
    case 'eee_premium':
      return STRIPE_FEE_EEE_PREMIUM;
    case 'uk':
      return STRIPE_FEE_UK_CARD;
    case 'international':
      return STRIPE_FEE_INTERNATIONAL_CARD;
    case 'sepa_debit':
      return { percent: 0, fixedCents: STRIPE_FEE_SEPA_DEBIT_FIXED_CENTS };
    default:
      return STRIPE_FEE_EEE_STANDARD;
  }
}

/** Estime les frais Stripe (centimes) : % + fixe. */
export function estimateStripeFeeCents(
  amountCents: number,
  config: StripeFeeEstimateConfig = {},
): number {
  if (amountCents <= 0) return 0;
  const tier = tierDefaults(config.tier ?? 'eee_standard');
  const pct = config.percent ?? tier.percent;
  const fixed = config.fixedCents ?? tier.fixedCents;
  let fee = Math.round(amountCents * (pct / 100)) + fixed;
  if (config.currencyConversion && (config.tier === 'uk' || config.tier === 'international')) {
    fee += Math.round(amountCents * (STRIPE_FEE_CURRENCY_CONVERSION_PERCENT / 100));
  }
  return Math.max(0, fee);
}

/** Libellé court du palier d'estimation (affichage finances). */
export function stripeFeeEstimateTierLabel(tier: StripeFeeEstimateTier = 'eee_standard'): string {
  switch (tier) {
    case 'eee_premium':
      return '1,9 % + 0,25 € (carte premium EEE)';
    case 'uk':
      return '2,5 % + 0,25 € (carte UK)';
    case 'international':
      return '3,25 % + 0,25 € (carte internationale)';
    case 'sepa_debit':
      return '0,35 € (prélèvement SEPA)';
    default:
      return '1,5 % + 0,25 € (carte standard EEE)';
  }
}

export type StripeFeeInstallmentInput = {
  amountCents: number;
  method: string;
  status: string;
  stripeFeeCents?: number | null;
  stripeNetCents?: number | null;
};

export type ReservationStripeFeesSummary = {
  /** Montant encaissé via Stripe (centimes). */
  stripeCollectedCents: number;
  /** Frais Stripe totaux (centimes). */
  stripeFeeCents: number;
  /** Net crédité en banque sur la part Stripe (centimes). */
  stripeNetCents: number;
  /** True si au moins un frais est estimé (pas encore sync. API). */
  estimated: boolean;
};

function feeForPaidOnlineInstallment(
  inst: StripeFeeInstallmentInput,
  estimate: StripeFeeEstimateConfig,
): { feeCents: number; netCents: number; estimated: boolean } {
  if (inst.status !== 'PAID' || inst.method !== 'ONLINE') {
    return { feeCents: 0, netCents: 0, estimated: false };
  }
  if (inst.stripeFeeCents != null && inst.stripeFeeCents >= 0) {
    const net =
      inst.stripeNetCents != null && inst.stripeNetCents >= 0
        ? inst.stripeNetCents
        : Math.max(0, inst.amountCents - inst.stripeFeeCents);
    return { feeCents: inst.stripeFeeCents, netCents: net, estimated: false };
  }
  const feeCents = estimateStripeFeeCents(inst.amountCents, estimate);
  return {
    feeCents,
    netCents: Math.max(0, inst.amountCents - feeCents),
    estimated: true,
  };
}

/** Agrège frais Stripe d'une réservation (échéances ou paiement unique). */
export function computeReservationStripeFees(input: {
  installmentPlan?: readonly StripeFeeInstallmentInput[];
  paymentChannel?: string | null;
  paymentCapturedAt?: Date | string | null;
  singlePaymentCents?: number | null;
  reservationStripeFeeCents?: number | null;
  reservationStripeNetCents?: number | null;
  estimate?: StripeFeeEstimateConfig;
}): ReservationStripeFeesSummary {
  const estimate = input.estimate ?? {};
  const plan = input.installmentPlan ?? [];

  if (plan.length > 0) {
    let stripeCollectedCents = 0;
    let stripeFeeCents = 0;
    let stripeNetCents = 0;
    let estimated = false;
    for (const inst of plan) {
      if (inst.status !== 'PAID' || inst.method !== 'ONLINE') continue;
      stripeCollectedCents += inst.amountCents;
      const part = feeForPaidOnlineInstallment(inst, estimate);
      stripeFeeCents += part.feeCents;
      stripeNetCents += part.netCents;
      if (part.estimated) estimated = true;
    }
    return { stripeCollectedCents, stripeFeeCents, stripeNetCents, estimated };
  }

  const online =
    String(input.paymentChannel ?? '').toLowerCase() === 'online' ||
    input.paymentChannel === 'ONLINE';
  if (!online || !input.paymentCapturedAt) {
    return { stripeCollectedCents: 0, stripeFeeCents: 0, stripeNetCents: 0, estimated: false };
  }

  const amountCents = Math.max(0, input.singlePaymentCents ?? 0);
  if (amountCents <= 0) {
    return { stripeCollectedCents: 0, stripeFeeCents: 0, stripeNetCents: 0, estimated: false };
  }

  if (input.reservationStripeFeeCents != null && input.reservationStripeFeeCents >= 0) {
    const net =
      input.reservationStripeNetCents != null && input.reservationStripeNetCents >= 0
        ? input.reservationStripeNetCents
        : Math.max(0, amountCents - input.reservationStripeFeeCents);
    return {
      stripeCollectedCents: amountCents,
      stripeFeeCents: input.reservationStripeFeeCents,
      stripeNetCents: net,
      estimated: false,
    };
  }

  const feeCents = estimateStripeFeeCents(amountCents, estimate);
  return {
    stripeCollectedCents: amountCents,
    stripeFeeCents: feeCents,
    stripeNetCents: Math.max(0, amountCents - feeCents),
    estimated: true,
  };
}

/** Taux effectif Stripe (%) sur la part encaissée en ligne. */
export function stripeEffectiveFeePercent(
  stripeCollectedCents: number,
  stripeFeeCents: number,
): number | null {
  if (stripeCollectedCents <= 0 || stripeFeeCents <= 0) return null;
  return Math.round((stripeFeeCents / stripeCollectedCents) * 10000) / 100;
}
