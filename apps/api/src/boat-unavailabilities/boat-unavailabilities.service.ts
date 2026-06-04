import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, type AuthUser, type UpsertUnavailabilityInput, upsertUnavailabilitySchema } from '@bleu-calanque/shared';
import { validateInput } from '../common/validation/validate-input';
import { OwnerScopeService } from '../common/auth/owner-scope.service';
import { InternalNotificationsService } from '../internal-notifications/internal-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EntityChecksService } from '../common/validation/entity-checks';

@Injectable()
export class BoatUnavailabilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entities: EntityChecksService,
    private readonly ownerScope: OwnerScopeService,
    private readonly internalNotifications: InternalNotificationsService,
  ) {}

  private parse(raw: unknown): UpsertUnavailabilityInput {
    return validateInput(upsertUnavailabilitySchema, raw);
  }

  async list(user: AuthUser) {
    const where =
      user.role === UserRole.OWNER
        ? { boat: { ownerMemberId: await this.ownerScope.requireOwnerMemberId(user) } }
        : {};
    return this.prisma.boatUnavailability.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: { boat: { select: { id: true, name: true, brand: true } } },
    });
  }

  async create(user: AuthUser, raw: unknown) {
    const input = this.parse(raw);
    await this.entities.assertBoatExists(input.boatId);
    if (user.role === UserRole.OWNER) {
      await this.ownerScope.assertBoatOwned(user, input.boatId);
    }
    const row = await this.prisma.boatUnavailability.create({
      data: {
        boatId: input.boatId,
        title: input.title,
        reason: input.reason ?? 'OTHER',
        note: input.note ?? null,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        createdByUserId: user.id,
      },
      include: { boat: true },
    });
    await this.internalNotifications.emitUnavailabilityChange('created', row, user);
    return row;
  }

  async update(user: AuthUser, id: string, raw: unknown) {
    const existing = await this.prisma.boatUnavailability.findUnique({
      where: { id },
      include: { boat: true },
    });
    if (!existing) throw new NotFoundException('Indisponibilité introuvable.');
    if (user.role === UserRole.OWNER) {
      await this.ownerScope.assertBoatOwned(user, existing.boatId);
    }
    const input = this.parse({ ...(raw as Record<string, unknown>), id, boatId: existing.boatId });
    if (input.boatId !== existing.boatId && user.role === UserRole.OWNER) {
      throw new ForbiddenException('Impossible de déplacer vers un autre bateau.');
    }
    const row = await this.prisma.boatUnavailability.update({
      where: { id },
      data: {
        title: input.title,
        reason: input.reason ?? existing.reason ?? 'OTHER',
        note: input.note ?? null,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        ...(user.role !== UserRole.OWNER && input.boatId !== existing.boatId
          ? { boatId: input.boatId }
          : {}),
      },
      include: { boat: true },
    });
    await this.internalNotifications.emitUnavailabilityChange('updated', row, user);
    return row;
  }

  async remove(user: AuthUser, id: string) {
    const existing = await this.prisma.boatUnavailability.findUnique({
      where: { id },
      include: { boat: true },
    });
    if (!existing) throw new NotFoundException('Indisponibilité introuvable.');
    if (user.role === UserRole.OWNER) {
      await this.ownerScope.assertBoatOwned(user, existing.boatId);
    }
    await this.prisma.boatUnavailability.delete({ where: { id } });
    await this.internalNotifications.emitUnavailabilityChange('deleted', existing, user);
    return { ok: true };
  }
}
