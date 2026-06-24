import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  computeExtraLineCents,
  createExtraRentalSchema,
  rentalDaysBetween,
  updateExtraRentalSchema,
} from '@bleu-calanque/shared';
import { ExtraRentalStatus, ExtraPriceKind, PaymentChannel, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntityChecksService } from '../common/validation/entity-checks';
import { ExtrasService } from '../extras/extras.service';
import { validateInput } from '../common/validation/validate-input';
import { AuditService } from '../common/audit/audit.service';
import { AuditEntity } from '../common/audit/audit.constants';
import type { CreateExtraRentalDto, UpdateExtraRentalDto } from './extra-rentals.dto';

const rentalInclude = {
  extra: { select: { id: true, name: true, icon: true, priceKind: true, paymentChannel: true } },
} satisfies Prisma.ExtraRentalInclude;

function clientDisplayName(input: {
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
}): string {
  const name = [input.clientFirstName, input.clientLastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  return input.clientEmail?.trim() || 'Client';
}

@Injectable()
export class ExtraRentalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entities: EntityChecksService,
    private readonly extras: ExtrasService,
    private readonly audit: AuditService,
  ) {}

  list(extraId?: string) {
    return this.prisma.extraRental.findMany({
      where: extraId ? { extraId } : undefined,
      orderBy: { startAt: 'desc' },
      include: rentalInclude,
    });
  }

  async get(id: string) {
    const row = await this.prisma.extraRental.findUnique({
      where: { id },
      include: rentalInclude,
    });
    if (!row) throw new NotFoundException('Location extra introuvable.');
    return row;
  }

  private async loadExtraForRental(extraId: string) {
    const extra = await this.prisma.extra.findUnique({ where: { id: extraId } });
    if (!extra) throw new BadRequestException('Extra introuvable.');
    if (!extra.enabled) throw new BadRequestException('Cet extra est inactif.');
    if (extra.priceKind === ExtraPriceKind.PERCENT) {
      throw new BadRequestException('Les extras en pourcentage ne peuvent pas être loués seuls.');
    }
    return extra;
  }

  private computeTotalCents(
    extra: { priceKind: ExtraPriceKind; priceValue: number; billingUnit: string },
    startAt: Date,
    endAt: Date,
    quantity: number,
  ): number {
    const rentalDays = rentalDaysBetween(startAt, endAt);
    return computeExtraLineCents(
      0,
      {
        quantity,
        extra: {
          priceKind: extra.priceKind,
          priceValue: extra.priceValue,
          billingUnit: extra.billingUnit as 'LOCATION' | 'JOUR' | 'SEMAINE',
        },
      },
      rentalDays,
    );
  }

  async create(raw: CreateExtraRentalDto) {
    const input = validateInput(createExtraRentalSchema, raw);
    const extra = await this.loadExtraForRental(input.extraId);
    if (input.clientMemberId) {
      await this.entities.assertMemberExists(input.clientMemberId);
    }

    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    const quantity = input.quantity ?? 1;

    await this.extras.assertStockForSlot({
      startAt,
      endAt,
      items: [{ extraId: input.extraId, quantity }],
    });

    const totalDueCents = this.computeTotalCents(extra, startAt, endAt, quantity);
    const title = `${extra.name} · ${clientDisplayName({
      clientFirstName: input.clientFirstName ?? null,
      clientLastName: input.clientLastName ?? null,
      clientEmail: input.clientEmail ?? null,
    })}`;
    const markPaid = Boolean(input.markPaid);
    const status: ExtraRentalStatus = markPaid ? 'PAID' : 'PENDING_PAYMENT';

    const row = await this.prisma.extraRental.create({
      data: {
        extraId: input.extraId,
        quantity,
        startAt,
        endAt,
        title,
        clientMemberId: input.clientMemberId ?? null,
        clientEmail: input.clientEmail?.trim() || null,
        clientFirstName: input.clientFirstName?.trim() || null,
        clientLastName: input.clientLastName?.trim() || null,
        clientPhone: input.clientPhone?.trim() || null,
        paymentChannel: extra.paymentChannel,
        totalDueCents,
        status,
        paymentCapturedAt: markPaid ? new Date() : null,
        settlementNote: input.settlementNote?.trim() || null,
        internalNote: input.internalNote?.trim() || null,
      },
      include: rentalInclude,
    });
    await this.audit.logCreate(AuditEntity.EXTRA_RENTAL, row.id, { id: row.id, title: row.title });
    return row;
  }

  async update(id: string, raw: UpdateExtraRentalDto) {
    const input = validateInput(updateExtraRentalSchema, raw);
    const existing = await this.get(id);
    if (existing.status === ExtraRentalStatus.CANCELLED) {
      throw new BadRequestException('Cette location est annulée.');
    }

    if (input.clientMemberId) {
      await this.entities.assertMemberExists(input.clientMemberId);
    }

    const startAt = input.startAt ? new Date(input.startAt) : existing.startAt;
    const endAt = input.endAt ? new Date(input.endAt) : existing.endAt;
    const quantity = input.quantity ?? existing.quantity;

    if (endAt <= startAt) {
      throw new BadRequestException('La fin du créneau doit être après le début.');
    }

    const extra = await this.loadExtraForRental(existing.extraId);

    if (
      startAt.getTime() !== existing.startAt.getTime() ||
      endAt.getTime() !== existing.endAt.getTime() ||
      quantity !== existing.quantity
    ) {
      await this.extras.assertStockForSlot({
        startAt,
        endAt,
        excludeExtraRentalId: id,
        items: [{ extraId: existing.extraId, quantity }],
      });
    }

    const totalDueCents = this.computeTotalCents(extra, startAt, endAt, quantity);
    const clientPatch = {
      clientMemberId:
        input.clientMemberId !== undefined ? input.clientMemberId : existing.clientMemberId,
      clientEmail: input.clientEmail !== undefined ? input.clientEmail?.trim() || null : existing.clientEmail,
      clientFirstName:
        input.clientFirstName !== undefined ? input.clientFirstName?.trim() || null : existing.clientFirstName,
      clientLastName:
        input.clientLastName !== undefined ? input.clientLastName?.trim() || null : existing.clientLastName,
      clientPhone: input.clientPhone !== undefined ? input.clientPhone?.trim() || null : existing.clientPhone,
    };
    const title = `${extra.name} · ${clientDisplayName(clientPatch)}`;

    let status: ExtraRentalStatus = existing.status;
    let paymentCapturedAt = existing.paymentCapturedAt;
    let cancelledAt = existing.cancelledAt;

    if (input.cancel) {
      status = ExtraRentalStatus.CANCELLED;
      cancelledAt = new Date();
    } else if (input.markPaid && status === ExtraRentalStatus.PENDING_PAYMENT) {
      status = ExtraRentalStatus.PAID;
      paymentCapturedAt = new Date();
    }

    const row = await this.prisma.extraRental.update({
      where: { id },
      data: {
        quantity,
        startAt,
        endAt,
        title,
        totalDueCents,
        status,
        paymentCapturedAt,
        cancelledAt,
        settlementNote:
          input.settlementNote !== undefined ? input.settlementNote?.trim() || null : existing.settlementNote,
        internalNote:
          input.internalNote !== undefined ? input.internalNote?.trim() || null : existing.internalNote,
        ...clientPatch,
      },
      include: rentalInclude,
    });
    await this.audit.logUpdate(AuditEntity.EXTRA_RENTAL, id, { id, title: existing.title }, { id, title: row.title });
    return row;
  }

  async remove(id: string) {
    const existing = await this.get(id);
    await this.prisma.extraRental.delete({ where: { id } });
    await this.audit.logDelete(AuditEntity.EXTRA_RENTAL, id, { id, title: existing.title });
    return { ok: true as const };
  }
}
