import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  createCouponRedemptionSchema,
  createCouponSchema,
  deleteCouponClientRedemptionsQuerySchema,
  updateCouponSchema,
} from '@bleu-calanque/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CouponDiscountKind } from '@prisma/client';
import { validateInput } from '../common/validation/validate-input';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction, AuditEntity } from '../common/audit/audit.constants';
import { entityIdNameSnapshot } from '../common/audit/audit-snapshots';
import type { CreateCouponDto, CreateRedemptionDto, UpdateCouponDto } from './coupons.dto';

function normalizeCode(v: string) {
  return (v ?? '').replaceAll(/\s+/g, '').toUpperCase();
}

function parseIsoDay(v: string | null | undefined): Date | null {
  if (!v) return null;
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  listRedemptions() {
    return this.prisma.couponRedemption.findMany({ orderBy: { redeemedAt: 'desc' } });
  }

  async create(raw: CreateCouponDto) {
    const input = validateInput(createCouponSchema, raw);
    const code = normalizeCode(input.code);
    if (!code) throw new BadRequestException('Le code est requis.');
    const exists = await this.prisma.coupon.findUnique({ where: { code } });
    if (exists) throw new ConflictException('Ce code existe déjà.');

    const validFrom = parseIsoDay(input.validFrom);
    if (!validFrom) throw new BadRequestException('Date de début invalide.');
    const validUntil = parseIsoDay(input.validUntil ?? null);

    const seasonMax = input.seasonMaxFullUsesPerClient ?? null;
    const seasonDeg = input.seasonDegradedDiscountValue ?? null;
    if ((seasonMax == null) !== (seasonDeg == null)) {
      throw new BadRequestException('La règle saisonnière doit définir maxFullUses + degradedDiscountValue ensemble.');
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        internalLabel: (input.internalLabel ?? '').trim(),
        discountKind: input.discountKind as CouponDiscountKind,
        discountValue: input.discountValue,
        validFrom,
        validUntil,
        enabled: input.enabled ?? true,
        seasonMaxFullUsesPerClient: seasonMax,
        seasonDegradedDiscountValue: seasonDeg,
        requiresAirbusBadge: input.requiresAirbusBadge ?? false,
      },
    });
    await this.audit.logCreate(AuditEntity.COUPON, coupon.id, entityIdNameSnapshot({ id: coupon.id, code: coupon.code }));
    return coupon;
  }

  async update(id: string, raw: UpdateCouponDto) {
    const input = validateInput(updateCouponSchema, raw);
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon introuvable.');

    const code = normalizeCode(input.code);
    if (!code) throw new BadRequestException('Le code est requis.');
    const conflict = await this.prisma.coupon.findFirst({ where: { code, NOT: { id } } });
    if (conflict) throw new ConflictException('Ce code existe déjà.');

    const validFrom = parseIsoDay(input.validFrom);
    if (!validFrom) throw new BadRequestException('Date de début invalide.');
    const validUntil = parseIsoDay(input.validUntil ?? null);

    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        code,
        internalLabel: (input.internalLabel ?? '').trim(),
        discountKind: input.discountKind as CouponDiscountKind,
        discountValue: input.discountValue,
        validFrom,
        validUntil,
        enabled: input.enabled ?? true,
        seasonMaxFullUsesPerClient: input.seasonMaxFullUsesPerClient ?? null,
        seasonDegradedDiscountValue: input.seasonDegradedDiscountValue ?? null,
        requiresAirbusBadge: input.requiresAirbusBadge ?? false,
      },
    });
    await this.audit.logUpdate(
      AuditEntity.COUPON,
      id,
      { code: existing.code, enabled: existing.enabled },
      { code: coupon.code, enabled: coupon.enabled },
    );
    return coupon;
  }

  async remove(id: string) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon introuvable.');
    await this.prisma.coupon.delete({ where: { id } });
    await this.audit.logDelete(AuditEntity.COUPON, id, entityIdNameSnapshot({ id: existing.id, code: existing.code }));
    return { ok: true as const };
  }

  async createRedemption(couponId: string, raw: CreateRedemptionDto) {
    const input = validateInput(createCouponRedemptionSchema, raw);
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('Coupon introuvable.');
    const clientKey = input.clientKey.trim();
    const redeemedAt = input.redeemedAt ? new Date(input.redeemedAt) : new Date();
    const redemption = await this.prisma.couponRedemption.create({
      data: { couponId, clientKey, redeemedAt },
    });
    await this.audit.log({
      action: AuditAction.CREATE,
      entity: AuditEntity.COUPON_REDEMPTION,
      entityId: redemption.id,
      newData: { couponId, couponCode: coupon.code, clientKey },
    });
    return redemption;
  }

  async clearRedemptions() {
    const count = await this.prisma.couponRedemption.count();
    await this.prisma.couponRedemption.deleteMany({});
    await this.audit.log({
      action: AuditAction.CLEAR_ALL,
      entity: AuditEntity.COUPON_REDEMPTION,
      oldData: { deletedCount: count },
    });
    return { ok: true as const };
  }

  /** Toutes les clés client liées au même membre (id + e-mail). */
  private async resolveClientKeysForDeletion(clientKey: string): Promise<string[]> {
    const keys = new Set<string>([clientKey]);
    if (clientKey.includes('@')) {
      const emailNorm = clientKey.toLowerCase();
      const member =
        (await this.prisma.member.findFirst({
          where: { email: emailNorm },
          select: { id: true, email: true },
        })) ??
        (await this.prisma.member.findFirst({
          where: { email: clientKey },
          select: { id: true, email: true },
        }));
      if (member) {
        keys.add(member.id);
        const email = member.email?.trim().toLowerCase();
        if (email) keys.add(email);
      }
    } else {
      const member = await this.prisma.member.findUnique({
        where: { id: clientKey },
        select: { id: true, email: true },
      });
      if (member) {
        keys.add(member.id);
        const email = member.email?.trim().toLowerCase();
        if (email) keys.add(email);
      }
    }
    return [...keys];
  }

  /**
   * Ré-enregistre une utilisation coupon pour une réservation (ex. après rétablissement).
   * N’altère pas les réservations — uniquement CouponRedemption.
   */
  async recordRedemptionForReservation(row: {
    couponCode: string | null;
    clientMemberId: string | null;
    clientEmail: string | null;
    startAt: Date;
  }): Promise<{ recorded: boolean }> {
    const code = row.couponCode?.trim().replaceAll(/\s+/g, '').toUpperCase();
    if (!code) return { recorded: false };
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon) return { recorded: false };

    const clientKey = row.clientMemberId?.trim() || row.clientEmail?.trim().toLowerCase() || '';
    if (!clientKey) return { recorded: false };

    const existing = await this.prisma.couponRedemption.findFirst({
      where: {
        couponId: coupon.id,
        clientKey,
        redeemedAt: row.startAt,
      },
    });
    if (existing) return { recorded: false };

    await this.prisma.couponRedemption.create({
      data: { couponId: coupon.id, clientKey, redeemedAt: row.startAt },
    });
    await this.audit.log({
      action: AuditAction.CREATE,
      entity: AuditEntity.COUPON_REDEMPTION,
      entityId: coupon.id,
      newData: { couponCode: coupon.code, clientKey, source: 'reservation_restore' },
    });
    return { recorded: true };
  }

  /** Rattrape les utilisations manquantes à partir des réservations actives (idempotent). */
  async syncRedemptionsFromReservations(couponId: string): Promise<{ created: number }> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('Coupon introuvable.');

    const reservations = await this.prisma.reservation.findMany({
      where: { couponCode: coupon.code, status: { not: 'CANCELLED' } },
      select: {
        couponCode: true,
        clientMemberId: true,
        clientEmail: true,
        startAt: true,
      },
    });

    let created = 0;
    for (const row of reservations) {
      const result = await this.recordRedemptionForReservation(row);
      if (result.recorded) created += 1;
    }
    return { created };
  }

  async removeRedemptionsForClient(couponId: string, raw: { clientKey: string }) {
    const { clientKey } = validateInput(deleteCouponClientRedemptionsQuerySchema, raw);
    const coupon = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('Coupon introuvable.');
    const clientKeys = await this.resolveClientKeysForDeletion(clientKey);
    const result = await this.prisma.couponRedemption.deleteMany({
      where: { couponId, clientKey: { in: clientKeys } },
    });
    if (result.count === 0) {
      throw new NotFoundException('Aucune utilisation enregistrée pour ce client.');
    }
    await this.audit.log({
      action: AuditAction.DELETE,
      entity: AuditEntity.COUPON_REDEMPTION,
      entityId: couponId,
      oldData: { couponCode: coupon.code, clientKey, clientKeys, deletedCount: result.count },
    });
    return { ok: true as const, deletedCount: result.count };
  }
}
