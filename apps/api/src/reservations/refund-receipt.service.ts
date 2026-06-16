import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PaymentChannel,
  RefundResolutionType,
  ReservationStatus,
  type Prisma,
} from '@prisma/client';
import {
  DEFAULT_BRAND_NAME,
  buildDocumentPaymentLines,
  isPaymentMethod,
  paymentMethodLabel,
  summarizeDocumentPaymentMethods,
} from '@bleu-calanque/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HtmlToPdfService } from '../rental-contracts/html-to-pdf.service';
import { computeReservationGrandTotalCents, reservationPricingInputFromRow } from '../pricing/reservation-pricing';
import { mapReservationExtrasForPricing } from '../pricing/reservation-pricing-map';
import { buildRefundReceiptHtml, type RefundReceiptViewModel } from './refund-receipt-html';

const reservationSelect = {
  id: true,
  createdAt: true,
  startAt: true,
  endAt: true,
  clientFirstName: true,
  clientLastName: true,
  clientAddress: true,
  clientPostalCode: true,
  clientCity: true,
  clientCountry: true,
  civility: true,
  detailsJson: true,
  rentalPriceCents: true,
  discountPercent: true,
  couponCode: true,
  clientMemberId: true,
  clientEmail: true,
  paymentCapturedAt: true,
  totalDueCents: true,
  paymentChannel: true,
  settlementNote: true,
  status: true,
  installmentPlan: { orderBy: { sequence: 'asc' as const } },
  boat: { select: { name: true } },
  extras: {
    include: {
      extra: {
        select: {
          name: true,
          vatRate: true,
          priceKind: true,
          priceValue: true,
          billingUnit: true,
        },
      },
    },
  },
  refunds: { orderBy: { refundedAt: 'asc' as const } },
  rentalContract: { select: { contractNumber: true } },
} satisfies Prisma.ReservationSelect;

type ReservationForReceipt = Prisma.ReservationGetPayload<{ select: typeof reservationSelect }>;

@Injectable()
export class RefundReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly htmlToPdf: HtmlToPdfService,
  ) {}

  async getPdfForReservation(
    reservationId: string,
  ): Promise<{ pdf: Buffer; filename: string; locationNumber: string }> {
    const row = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: reservationSelect,
    });
    if (!row) throw new NotFoundException('Réservation introuvable.');

    if (row.refunds.length === 0) {
      throw new BadRequestException('Aucun remboursement enregistré pour cette réservation.');
    }

    const hasRefundStatus =
      row.status === ReservationStatus.REFUNDED ||
      row.status === ReservationStatus.PARTIALLY_REFUNDED;
    if (!hasRefundStatus && row.refunds.length === 0) {
      throw new BadRequestException('Cette réservation n’est pas remboursée.');
    }

    const vm = await this.buildViewModel(row);
    const html = buildRefundReceiptHtml(vm);
    const pdf = await this.htmlToPdf.fromHtml(html);
    const filename = `justificatif-remboursement-${vm.locationNumber}.pdf`;
    return { pdf, filename, locationNumber: vm.locationNumber };
  }

  private async buildViewModel(row: ReservationForReceipt): Promise<RefundReceiptViewModel> {
    const company = await this.prisma.companySettings.findUnique({
      where: { id: 'company_settings' },
    });

    const totalCents = await this.resolveTotalCents(row);
    const vatRate = company?.vatPercent ?? 20;
    const vat = this.vatFromTtc(totalCents / 100, vatRate);

    const locationNumber = this.resolveLocationNumber(row);
    const lines = this.buildChargeLines(row, totalCents);
    const paymentDocInput = this.buildPaymentDocInput(row, totalCents);
    const paymentSummary = summarizeDocumentPaymentMethods(paymentDocInput);
    const paymentLines = buildDocumentPaymentLines(paymentDocInput);
    const refunds = row.refunds.map((r) => ({
      label: `${this.refundMethodLabel(r.resolutionType, row.paymentChannel, paymentSummary)} — ${this.formatDate(r.refundedAt)}`,
      amount: this.euros(r.amountCents),
    }));
    const totalRefundedCents = row.refunds.reduce((sum, r) => sum + r.amountCents, 0);

    const addressLines = this.companyAddressLines(company);
    const clientAddressLines = this.clientAddressLines(row);

    return {
      company: {
        brandName: (company?.brandName || company?.tradeName || DEFAULT_BRAND_NAME).trim(),
        addressLines,
        postalCode: (company?.postalCode ?? '').trim(),
        city: (company?.city ?? '').trim(),
        country: (company?.country ?? 'France').trim(),
        vatNumber: (company?.vatNumber ?? '').trim(),
      },
      logoSvg: this.loadLogoSvg(),
      clientName: this.formatClientName(row),
      clientAddressLines,
      locationNumber,
      checkIn: this.formatDateTime(row.startAt),
      checkOut: this.formatDateTime(row.endAt),
      paymentSummary,
      paymentLines: paymentLines.map((line) => ({
        date: line.paidAt ? this.formatDate(line.paidAt) : '—',
        method: line.methodLabel,
        amount: this.euros(line.amountCents),
      })),
      lines,
      total: this.euros(totalCents),
      vatAmount: this.formatEuroAmount(vat.vat),
      refunds,
      totalRefunded: this.euros(totalRefundedCents),
    };
  }

  private companyAddressLines(
    company: {
      addressLine?: string | null;
      domiciliation?: string | null;
    } | null,
  ): string[] {
    const lines: string[] = [];
    const address = (company?.addressLine ?? '').trim();
    const domiciliation = (company?.domiciliation ?? '').trim();
    if (address) lines.push(address);
    if (domiciliation && domiciliation !== address) lines.push(domiciliation);
    return lines;
  }

  private clientAddressLines(row: ReservationForReceipt): string[] {
    const lines: string[] = [];
    const postal = (row.clientPostalCode ?? '').trim();
    const address = (row.clientAddress ?? '').trim();
    const city = (row.clientCity ?? '').trim();
    const country = (row.clientCountry ?? '').trim();

    const streetLine = [postal, address].filter(Boolean).join(' ').trim();
    if (streetLine) lines.push(streetLine);

    const cityLine = [postal, city].filter(Boolean).join(' ').trim();
    if (cityLine) lines.push(cityLine.toUpperCase());

    if (country) lines.push(country.toUpperCase());
    return lines.length ? lines : ['—'];
  }

  private formatClientName(row: ReservationForReceipt): string {
    const f = (row.clientFirstName ?? '').trim();
    const l = (row.clientLastName ?? '').trim();
    if (!f && !l) return '—';
    const name = !f ? l.toUpperCase() : !l ? f : `${f} ${l.toUpperCase()}`;
    const civ = (row.civility ?? '').trim();
    return civ ? `${civ} ${name}` : name;
  }

  private resolveLocationNumber(row: ReservationForReceipt): string {
    if (row.rentalContract?.contractNumber != null) {
      return String(row.rentalContract.contractNumber);
    }
    const compact = row.id.replaceAll('-', '').slice(0, 7);
    const numeric = Number.parseInt(compact, 16);
    if (Number.isFinite(numeric)) {
      return String(1_000_000 + (numeric % 900_000));
    }
    return row.id.slice(0, 8).toUpperCase();
  }

  private buildChargeLines(row: ReservationForReceipt, totalCents: number): RefundReceiptViewModel['lines'] {
    const boatName = (row.boat.name ?? 'Bateau').trim();
    return [{ designation: `Location ${boatName.toUpperCase()}`, amount: this.euros(totalCents) }];
  }

  private async resolveTotalCents(row: ReservationForReceipt): Promise<number> {
    const { pricing } = await computeReservationGrandTotalCents(
      this.prisma,
      reservationPricingInputFromRow(row, mapReservationExtrasForPricing(row.extras)),
    );
    return pricing.grandTotalCents;
  }

  private buildPaymentDocInput(row: ReservationForReceipt, totalDueCents: number) {
    const detailsMethods = this.parseInstallmentMethodsFromDetails(row.detailsJson);
    return {
      paymentChannel: row.paymentChannel,
      paymentCapturedAt: row.paymentCapturedAt,
      settlementNote: row.settlementNote,
      totalDueCents,
      installmentPlan: row.installmentPlan.map((p) => ({
        sequence: p.sequence,
        label: p.label,
        amountCents: p.amountCents,
        method: p.method,
        status: p.status,
        paidAt: p.paidAt,
      })),
      fallbackMethod: detailsMethods?.[0] ?? null,
    };
  }

  private parseInstallmentMethodsFromDetails(json: string | null) {
    if (!json) return null;
    try {
      const parsed = JSON.parse(json) as { installmentMethods?: unknown };
      if (!Array.isArray(parsed.installmentMethods)) return null;
      const methods = parsed.installmentMethods.filter(isPaymentMethod);
      return methods.length > 0 ? methods : null;
    } catch {
      return null;
    }
  }

  private refundMethodLabel(
    resolutionType: RefundResolutionType,
    paymentChannel: PaymentChannel,
    originalPaymentSummary: string,
  ): string {
    if (resolutionType === RefundResolutionType.STORE_CREDIT) return 'Avoir';
    if (paymentChannel === PaymentChannel.ONLINE) return `Remboursement (${paymentMethodLabel('ONLINE')})`;
    if (originalPaymentSummary && originalPaymentSummary !== 'Hors ligne') {
      return `Remboursement (${originalPaymentSummary})`;
    }
    return `Remboursement (${paymentMethodLabel('TRANSFER')})`;
  }

  private vatFromTtc(ttc: number, rate = 20) {
    const ht = ttc / (1 + rate / 100);
    const vat = ttc - ht;
    return { ht, vat, ttc };
  }

  private formatDateTime(d: Date): string {
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatDate(d: Date): string {
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private euros(cents: number | null | undefined): string {
    if (cents == null) return '—';
    return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
  }

  private formatEuroAmount(amount: number): string {
    return `${amount.toFixed(2).replace('.', ',')} €`;
  }

  private loadLogoSvg(): string {
    // Les documents clients affichent le nom commercial (company.brandName), pas le logo plateforme Azur.
    return '';
  }
}
