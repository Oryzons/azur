import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  calendarDaysInRange,
  createExtraSchema,
  endOfCalendarDay,
  maxDailyExtraReservedFromSlots,
  startOfCalendarDay,
  updateExtraSchema,
  type ExtraAvailability,
} from '@bleu-calanque/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ExtraBillingUnit, ExtraPriceKind, ExtraRentalStatus, PaymentChannel, ReservationStatus } from '@prisma/client';
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

const STOCK_CONSUMING_EXTRA_RENTAL_STATUSES: ExtraRentalStatus[] = ['PENDING_PAYMENT', 'PAID'];
/** Réservations actives qui consomment du stock d'extras. */
const STOCK_CONSUMING_STATUSES: ReservationStatus[] = [
  'PENDING_PAYMENT',
  'RESERVED_PAID',
  'PARTIALLY_REFUNDED',
];

function parseSlotRange(start: string, end: string): { startAt: Date; endAt: Date } {
  const startAt = new Date(start);
  const endAt = new Date(end);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new BadRequestException('Créneau start/end invalide.');
  }
  if (endAt <= startAt) {
    throw new BadRequestException('La fin du créneau doit être après le début.');
  }
  return { startAt, endAt };
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

  /**
   * Stock restant par extra sur un créneau : stock catalogue (par jour) − quantités
   * déjà réservées sur chaque jour civil couvert par le créneau.
   * Ex. stock 2 : 2 le lundi + 1 le mardi OK ; 3 le même lundi refusé.
   */
  async getAvailability(input: {
    start: string;
    end: string;
    excludeReservationId?: string;
    excludeExtraRentalId?: string;
  }): Promise<Record<string, ExtraAvailability>> {
    const { startAt, endAt } = parseSlotRange(input.start, input.end);
    const days = calendarDaysInRange(startAt, endAt);
    const rangeStart = startOfCalendarDay(startAt);
    const rangeEnd = endOfCalendarDay(days[days.length - 1] ?? startAt);

    const [extras, overlapping, standaloneRentals] = await Promise.all([
      this.prisma.extra.findMany({
        where: { enabled: true },
        select: { id: true, stock: true },
      }),
      this.prisma.reservation.findMany({
        where: {
          status: { in: STOCK_CONSUMING_STATUSES },
          startAt: { lt: rangeEnd },
          endAt: { gt: rangeStart },
          ...(input.excludeReservationId ? { id: { not: input.excludeReservationId } } : {}),
        },
        select: {
          startAt: true,
          endAt: true,
          extras: { select: { extraId: true, quantity: true } },
        },
      }),
      this.prisma.extraRental.findMany({
        where: {
          status: { in: STOCK_CONSUMING_EXTRA_RENTAL_STATUSES },
          startAt: { lt: rangeEnd },
          endAt: { gt: rangeStart },
          ...(input.excludeExtraRentalId ? { id: { not: input.excludeExtraRentalId } } : {}),
        },
        select: { startAt: true, endAt: true, extraId: true, quantity: true },
      }),
    ]);

    const slots = [
      ...overlapping.map((r) => ({
        startAt: r.startAt,
        endAt: r.endAt,
        lines: r.extras.map((line) => ({
          extraId: line.extraId,
          quantity: line.quantity > 0 ? line.quantity : 1,
        })),
      })),
      ...standaloneRentals.map((r) => ({
        startAt: r.startAt,
        endAt: r.endAt,
        lines: [{ extraId: r.extraId, quantity: r.quantity > 0 ? r.quantity : 1 }],
      })),
    ];

    const out: Record<string, ExtraAvailability> = {};
    for (const ex of extras) {
      const reserved = maxDailyExtraReservedFromSlots({ days, slots, extraId: ex.id });
      if (ex.stock == null) {
        out[ex.id] = { stock: null, reserved, remaining: null };
      } else {
        out[ex.id] = {
          stock: ex.stock,
          reserved,
          remaining: Math.max(0, ex.stock - reserved),
        };
      }
    }
    return out;
  }

  /** Vérifie que les extras demandés tiennent dans le stock journalier du créneau. */
  async assertStockForSlot(input: {
    startAt: Date;
    endAt: Date;
    excludeReservationId?: string;
    excludeExtraRentalId?: string;
    items: { extraId: string; quantity?: number }[];
  }): Promise<void> {
    if (!input.items.length) return;
    if (input.endAt <= input.startAt) return;

    const availability = await this.getAvailability({
      start: input.startAt.toISOString(),
      end: input.endAt.toISOString(),
      excludeReservationId: input.excludeReservationId,
      excludeExtraRentalId: input.excludeExtraRentalId,
    });

    for (const item of input.items) {
      const qty = item.quantity != null && item.quantity > 0 ? item.quantity : 1;
      const slot = availability[item.extraId];
      if (!slot || slot.remaining == null) continue;
      if (qty > slot.remaining) {
        const extra = await this.prisma.extra.findUnique({
          where: { id: item.extraId },
          select: { name: true },
        });
        const name = extra?.name ?? 'Extra';
        throw new BadRequestException(
          slot.remaining === 0
            ? `« ${name} » : plus de stock disponible ce jour-là.`
            : `« ${name} » : seulement ${slot.remaining} disponible(s) ce jour-là (demandé : ${qty}).`,
        );
      }
    }
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
        icon: input.icon?.trim() || null,
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
        icon: input.icon?.trim() || null,
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

