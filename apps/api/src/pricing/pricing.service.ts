import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  createPricingPeriodSchema,
  upsertBoatPriceSchema,
  upsertFleetPriceSchema,
} from '@bleu-calanque/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PricingUnit } from '@prisma/client';
import { EntityChecksService } from '../common/validation/entity-checks';
import { validateInput } from '../common/validation/validate-input';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction, AuditEntity } from '../common/audit/audit.constants';
import { entityIdNameSnapshot } from '../common/audit/audit-snapshots';
import type { CreatePricingPeriodDto, UpdatePricingPeriodDto, UpsertBoatPriceDto, UpsertFleetPriceDto } from './pricing.dto';

function parseIsoDay(v: string | null | undefined): Date | null {
  if (!v) return null;
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Identifiants stables pour les 3 saisons (tarifs). */
const SEASON_PERIOD_DEFS = [
  {
    id: 'pp_season_basse',
    code: 'BASSE',
    name: 'Basse saison',
    startDate: new Date('2000-01-01T00:00:00.000Z'),
    endDate: new Date('2000-02-28T00:00:00.000Z'),
  },
  {
    id: 'pp_season_moyenne',
    code: 'MOYENNE',
    name: 'Moyenne saison',
    startDate: new Date('2000-03-01T00:00:00.000Z'),
    endDate: new Date('2000-05-31T00:00:00.000Z'),
  },
  {
    id: 'pp_season_haute',
    code: 'HAUTE',
    name: 'Haute saison',
    startDate: new Date('2000-06-01T00:00:00.000Z'),
    endDate: new Date('2000-09-30T00:00:00.000Z'),
  },
] as const;

@Injectable()
export class PricingService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entities: EntityChecksService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultSeasonPeriods();
  }

  /** Crée ou met à jour les 3 périodes saisonnières (idempotent). */
  async ensureDefaultSeasonPeriods() {
    for (const def of SEASON_PERIOD_DEFS) {
      await this.prisma.pricingPeriod.upsert({
        where: { id: def.id },
        create: {
          id: def.id,
          code: def.code,
          name: def.name,
          startDate: def.startDate,
          endDate: def.endDate,
          active: true,
        },
        update: {
          code: def.code,
          name: def.name,
          active: true,
        },
      });
    }
  }

  listPeriods() {
    return this.prisma.pricingPeriod.findMany({ orderBy: { startDate: 'asc' } });
  }

  listPrices() {
    return this.prisma.boatPrice.findMany();
  }

  listFleetPrices() {
    return this.prisma.fleetPrice.findMany();
  }

  async createPeriod(input: CreatePricingPeriodDto) {
    const name = (input.name ?? '').trim();
    if (!name) throw new BadRequestException('Nom de période requis.');
    const startDate = parseIsoDay(input.startDate);
    const endDate = parseIsoDay(input.endDate);
    if (!startDate || !endDate) throw new BadRequestException('Dates invalides.');
    if (startDate.getTime() > endDate.getTime()) throw new BadRequestException('Fin doit être après début.');
    const period = await this.prisma.pricingPeriod.create({
      data: { name, startDate, endDate, active: input.active ?? true },
    });
    await this.audit.logCreate(AuditEntity.PRICING_PERIOD, period.id, entityIdNameSnapshot(period));
    return period;
  }

  async updatePeriod(id: string, input: UpdatePricingPeriodDto) {
    const existing = await this.prisma.pricingPeriod.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Période introuvable.');
    if (existing.code) {
      throw new BadRequestException('Les périodes saisonnières fixes ne sont pas modifiables depuis l’API.');
    }
    const name = (input.name ?? '').trim();
    if (!name) throw new BadRequestException('Nom de période requis.');
    const startDate = parseIsoDay(input.startDate);
    const endDate = parseIsoDay(input.endDate);
    if (!startDate || !endDate) throw new BadRequestException('Dates invalides.');
    if (startDate.getTime() > endDate.getTime()) throw new BadRequestException('Fin doit être après début.');
    const period = await this.prisma.pricingPeriod.update({
      where: { id },
      data: { name, startDate, endDate, active: input.active ?? true },
    });
    await this.audit.logUpdate(AuditEntity.PRICING_PERIOD, id, entityIdNameSnapshot(existing), entityIdNameSnapshot(period));
    return period;
  }

  async removePeriod(id: string) {
    const existing = await this.prisma.pricingPeriod.findUnique({ where: { id } });
    if (existing?.code) {
      throw new BadRequestException('Impossible de supprimer une période saisonnière fixe.');
    }
    if (!existing) throw new NotFoundException('Période introuvable.');
    await this.prisma.pricingPeriod.delete({ where: { id } });
    await this.audit.logDelete(AuditEntity.PRICING_PERIOD, id, entityIdNameSnapshot(existing));
    return { ok: true as const };
  }

  async upsertPrice(periodId: string, raw: UpsertBoatPriceDto) {
    const input = validateInput(upsertBoatPriceSchema, raw);
    await this.entities.assertBoatExists(input.boatId);
    const existing = await this.prisma.boatPrice.findUnique({
      where: {
        boatId_periodId_unit: {
          boatId: input.boatId,
          periodId,
          unit: input.unit as PricingUnit,
        },
      },
    });
    const price = await this.prisma.boatPrice.upsert({
      where: {
        boatId_periodId_unit: {
          boatId: input.boatId,
          periodId,
          unit: input.unit as PricingUnit,
        },
      },
      update: { amountCents: input.amountCents },
      create: {
        boatId: input.boatId,
        periodId,
        unit: input.unit as PricingUnit,
        amountCents: input.amountCents,
      },
    });
    await this.audit.log({
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      entity: AuditEntity.PRICING_PRICE,
      entityId: `${input.boatId}:${periodId}:${input.unit}`,
      oldData: existing ? { amountCents: existing.amountCents } : undefined,
      newData: { boatId: input.boatId, periodId, unit: input.unit, amountCents: price.amountCents },
    });
    return price;
  }

  async deletePrice(periodId: string, boatId: string, unit: string) {
    const existing = await this.prisma.boatPrice.findUnique({
      where: { boatId_periodId_unit: { boatId, periodId, unit: unit as PricingUnit } },
    });
    if (!existing) return { ok: true as const };
    await this.prisma.boatPrice.delete({
      where: { boatId_periodId_unit: { boatId, periodId, unit: unit as PricingUnit } },
    });
    await this.audit.logDelete(AuditEntity.PRICING_PRICE, `${boatId}:${periodId}:${unit}`, {
      amountCents: existing.amountCents,
    });
    return { ok: true as const };
  }

  async upsertFleetPrice(periodId: string, raw: UpsertFleetPriceDto) {
    const input = validateInput(upsertFleetPriceSchema, raw);
    await this.entities.assertFleetExists(input.fleetId);
    const existing = await this.prisma.fleetPrice.findUnique({
      where: {
        fleetId_periodId_unit: {
          fleetId: input.fleetId,
          periodId,
          unit: input.unit as PricingUnit,
        },
      },
    });
    const price = await this.prisma.fleetPrice.upsert({
      where: {
        fleetId_periodId_unit: {
          fleetId: input.fleetId,
          periodId,
          unit: input.unit as PricingUnit,
        },
      },
      update: { amountCents: input.amountCents },
      create: {
        fleetId: input.fleetId,
        periodId,
        unit: input.unit as PricingUnit,
        amountCents: input.amountCents,
      },
    });
    await this.audit.log({
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      entity: AuditEntity.PRICING_PRICE,
      entityId: `fleet:${input.fleetId}:${periodId}:${input.unit}`,
      oldData: existing ? { amountCents: existing.amountCents } : undefined,
      newData: { fleetId: input.fleetId, periodId, unit: input.unit, amountCents: price.amountCents },
    });
    return price;
  }

  async deleteFleetPrice(periodId: string, fleetId: string, unit: string) {
    const existing = await this.prisma.fleetPrice.findUnique({
      where: { fleetId_periodId_unit: { fleetId, periodId, unit: unit as PricingUnit } },
    });
    if (!existing) return { ok: true as const };
    await this.prisma.fleetPrice.delete({
      where: { fleetId_periodId_unit: { fleetId, periodId, unit: unit as PricingUnit } },
    });
    await this.audit.logDelete(AuditEntity.PRICING_PRICE, `fleet:${fleetId}:${periodId}:${unit}`, {
      amountCents: existing.amountCents,
    });
    return { ok: true as const };
  }
}
