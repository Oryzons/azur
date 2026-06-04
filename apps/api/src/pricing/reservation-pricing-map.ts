import type { ExtraBillingUnit, ExtraPriceKind } from '@prisma/client';
import type { ExtraLineForPricing } from '@bleu-calanque/shared';

export function mapReservationExtrasForPricing(
  lines: {
    quantity: number;
    extra: { priceKind: ExtraPriceKind; priceValue: number; billingUnit: ExtraBillingUnit };
  }[],
): ExtraLineForPricing[] {
  return lines.map((line) => ({
    quantity: line.quantity,
    extra: {
      priceKind: line.extra.priceKind,
      priceValue: line.extra.priceValue,
      billingUnit: line.extra.billingUnit,
    },
  }));
}
