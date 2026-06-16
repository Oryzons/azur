import { PaymentChannel, type ExtraBillingUnit, type ExtraPriceKind } from '@prisma/client';
import type { ExtraLineWithChannel } from '@bleu-calanque/shared';

export function mapReservationExtrasForPricing(
  lines: {
    quantity: number;
    extra: {
      priceKind: ExtraPriceKind;
      priceValue: number;
      billingUnit: ExtraBillingUnit;
      paymentChannel?: PaymentChannel;
    };
  }[],
  opts?: { onlineOnly?: boolean },
): ExtraLineWithChannel[] {
  const filtered = opts?.onlineOnly
    ? lines.filter((l) => l.extra.paymentChannel !== PaymentChannel.OFFLINE)
    : lines;
  return filtered.map((line) => ({
    quantity: line.quantity,
    paymentChannel: line.extra.paymentChannel,
    extra: {
      priceKind: line.extra.priceKind,
      priceValue: line.extra.priceValue,
      billingUnit: line.extra.billingUnit,
    },
  }));
}
