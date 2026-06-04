import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createExtraSchema, updateExtraSchema } from '@bleu-calanque/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ExtraBillingUnit, ExtraPriceKind, PaymentChannel } from '@prisma/client';
import { validateInput } from '../common/validation/validate-input';
import { AuditService } from '../common/audit/audit.service';
import { AuditEntity } from '../common/audit/audit.constants';
import { entityIdNameSnapshot } from '../common/audit/audit-snapshots';
import type { CreateExtraDto, UpdateExtraDto } from './extras.dto';

function trimOrThrow(v: string, label: string) {
  const x = v.trim();
  if (!x) throw new BadRequestException(`${label} requis.`);
  return x;
}

@Injectable()
export class ExtrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.extra.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(raw: CreateExtraDto) {
    const input = validateInput(createExtraSchema, raw);
    const name = trimOrThrow(input.name, 'Nom');
    const description = String(input.description ?? '').trim();
    const paymentChannel = (input.paymentChannel ?? 'ONLINE') as unknown as PaymentChannel;
    const enabled = input.enabled ?? true;

    if (input.priceKind === 'EURO' && input.priceValue === 0) {
      throw new BadRequestException('Tarif : montant > 0.');
    }

    const extra = await this.prisma.extra.create({
      data: {
        name,
        description,
        priceKind: input.priceKind as unknown as ExtraPriceKind,
        priceValue: input.priceValue,
        billingUnit: input.billingUnit as unknown as ExtraBillingUnit,
        vatRate: input.vatRate,
        stock: input.stock ?? null,
        paymentChannel,
        enabled,
      },
    });
    await this.audit.logCreate(AuditEntity.EXTRA, extra.id, entityIdNameSnapshot(extra));
    return extra;
  }

  async update(id: string, raw: UpdateExtraDto) {
    const input = validateInput(updateExtraSchema, raw);
    const exists = await this.prisma.extra.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Extra introuvable.');

    const name = trimOrThrow(input.name, 'Nom');
    const description = String(input.description ?? '').trim();
    const paymentChannel = (input.paymentChannel ?? 'ONLINE') as unknown as PaymentChannel;
    const enabled = input.enabled ?? true;

    if (input.priceKind === 'EURO' && input.priceValue === 0) {
      throw new BadRequestException('Tarif : montant > 0.');
    }

    const extra = await this.prisma.extra.update({
      where: { id },
      data: {
        name,
        description,
        priceKind: input.priceKind as unknown as ExtraPriceKind,
        priceValue: input.priceValue,
        billingUnit: input.billingUnit as unknown as ExtraBillingUnit,
        vatRate: input.vatRate,
        stock: input.stock ?? null,
        paymentChannel,
        enabled,
      },
    });
    await this.audit.logUpdate(AuditEntity.EXTRA, id, entityIdNameSnapshot(exists), entityIdNameSnapshot(extra));
    return extra;
  }

  async remove(id: string) {
    const existing = await this.prisma.extra.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Extra introuvable.');
    await this.prisma.extra.delete({ where: { id } });
    await this.audit.logDelete(AuditEntity.EXTRA, id, entityIdNameSnapshot(existing));
    return { ok: true as const };
  }
}

