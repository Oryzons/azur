import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  createBoatSchema,
  createFleetSchema,
  patchBoatDepositSchema,
  UserRole,
  type AuthUser,
} from '@bleu-calanque/shared';
import { OwnerScopeService } from '../common/auth/owner-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { BoatType, Prisma } from '@prisma/client';
import { EntityChecksService } from '../common/validation/entity-checks';
import { validateInput } from '../common/validation/validate-input';
import type { CreateBoatDto, CreateFleetDto, UpdateBoatDto, UpdateFleetDto } from './dto';
import { SecureMediaService } from '../common/media/secure-media.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditEntity } from '../common/audit/audit.constants';
import { entityIdNameSnapshot } from '../common/audit/audit-snapshots';

function trimOrThrow(v: string, label: string) {
  const x = v.trim();
  if (!x) throw new BadRequestException(`${label} requis.`);
  return x;
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entities: EntityChecksService,
    private readonly media: SecureMediaService,
    private readonly audit: AuditService,
    private readonly ownerScope: OwnerScopeService,
  ) {}

  async listFleets() {
    return this.prisma.fleet.findMany({ orderBy: { name: 'asc' } });
  }

  async createFleet(raw: CreateFleetDto) {
    const input = validateInput(createFleetSchema, raw);
    const name = trimOrThrow(input.name, 'Nom flotille');
    const fleet = await this.prisma.fleet.create({ data: { name } });
    await this.audit.logCreate(AuditEntity.FLEET, fleet.id, entityIdNameSnapshot(fleet));
    return fleet;
  }

  async updateFleet(id: string, raw: UpdateFleetDto) {
    const input = validateInput(createFleetSchema, raw);
    const name = trimOrThrow(input.name, 'Nom flotille');
    const existing = await this.prisma.fleet.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Flotille introuvable.');
    const fleet = await this.prisma.fleet.update({ where: { id }, data: { name } });
    await this.audit.logUpdate(AuditEntity.FLEET, id, entityIdNameSnapshot(existing), entityIdNameSnapshot(fleet));
    return fleet;
  }

  async deleteFleet(id: string) {
    const existing = await this.prisma.fleet.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Flotille introuvable.');
    await this.prisma.fleet.delete({ where: { id } });
    await this.audit.logDelete(AuditEntity.FLEET, id, entityIdNameSnapshot(existing));
    return { ok: true as const };
  }

  async listBoats(user: AuthUser) {
    const where =
      user.role === UserRole.OWNER
        ? { ownerMemberId: await this.ownerScope.requireOwnerMemberId(user) }
        : {};
    return this.prisma.boat.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async createBoat(raw: CreateBoatDto) {
    const input = validateInput(createBoatSchema, raw);
    if (input.fleetId) await this.entities.assertFleetExists(input.fleetId);
    if (input.ownerMemberId) await this.entities.assertMemberExists(input.ownerMemberId);
    const brand = trimOrThrow(input.brand, 'Marque');
    const name = trimOrThrow(input.name, 'Nom');
    const model = trimOrThrow(input.model, 'Modèle');
    const photos = await this.media.processPresentationPhotos(
      input.presentationPhotos ?? [],
      input.coverPhotoIndex ?? 0,
    );

    const boat = await this.prisma.boat.create({
      data: {
        brand,
        name,
        model,
        boatType: input.boatType as unknown as BoatType,
        maxPassengers: input.maxPassengers,
        fleetId: input.fleetId ?? null,
        ownerMemberId: input.ownerMemberId ?? null,
        detailsJson: input.detailsJson ?? null,
        depositAmountCents: input.depositAmountCents ?? 250000,
        photos: photos.length
          ? {
              create: photos.map((url, idx) => ({ url, sortOrder: idx })),
            }
          : undefined,
      },
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.audit.logCreate(AuditEntity.BOAT, boat.id, {
      ...entityIdNameSnapshot(boat),
      brand: boat.brand,
      model: boat.model,
      photoCount: boat.photos.length,
    });
    return boat;
  }

  async updateBoat(id: string, raw: UpdateBoatDto) {
    const input = validateInput(createBoatSchema, raw);
    if (input.fleetId) await this.entities.assertFleetExists(input.fleetId);
    if (input.ownerMemberId) await this.entities.assertMemberExists(input.ownerMemberId);
    const brand = trimOrThrow(input.brand, 'Marque');
    const name = trimOrThrow(input.name, 'Nom');
    const model = trimOrThrow(input.model, 'Modèle');
    const exists = await this.prisma.boat.findUnique({
      where: { id },
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!exists) throw new NotFoundException('Bateau introuvable.');

    const photos = await this.media.processPresentationPhotos(
      input.presentationPhotos ?? [],
      input.coverPhotoIndex ?? 0,
      { retainUrls: exists.photos.map((p) => p.url) },
    );

    const data: Prisma.BoatUncheckedUpdateInput = {
      brand,
      name,
      model,
      boatType: input.boatType as unknown as BoatType,
      maxPassengers: input.maxPassengers,
      fleetId: input.fleetId ?? null,
      ownerMemberId: input.ownerMemberId ?? null,
      detailsJson: input.detailsJson ?? null,
      photos: {
        deleteMany: { boatId: id },
        create: photos.map((url, idx) => ({ url, sortOrder: idx })),
      },
    };
    if (input.depositAmountCents !== undefined && input.depositAmountCents !== null) {
      data.depositAmountCents = input.depositAmountCents;
    }

    const boat = await this.prisma.boat.update({
      where: { id },
      data,
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.audit.logUpdate(
      AuditEntity.BOAT,
      id,
      { name: exists.name, brand: exists.brand, depositAmountCents: exists.depositAmountCents },
      { name: boat.name, brand: boat.brand, depositAmountCents: boat.depositAmountCents, photoCount: boat.photos.length },
    );
    return boat;
  }

  async deleteBoat(id: string) {
    const existing = await this.prisma.boat.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bateau introuvable.');
    await this.prisma.boat.delete({ where: { id } });
    await this.audit.logDelete(AuditEntity.BOAT, id, entityIdNameSnapshot(existing));
    return { ok: true as const };
  }

  async patchBoatDeposit(id: string, depositAmountCents: number) {
    const parsed = validateInput(patchBoatDepositSchema, { depositAmountCents });
    depositAmountCents = parsed.depositAmountCents;
    const exists = await this.prisma.boat.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Bateau introuvable.');
    const boat = await this.prisma.boat.update({
      where: { id },
      data: { depositAmountCents },
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.audit.logUpdate(
      AuditEntity.BOAT,
      id,
      { depositAmountCents: exists.depositAmountCents },
      { depositAmountCents: boat.depositAmountCents },
    );
    return boat;
  }
}

