import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createAnnouncementSchema } from '@bleu-calanque/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementLinkKind, AnnouncementStatus, BoatType } from '@prisma/client';
import { EntityChecksService } from '../common/validation/entity-checks';
import { validateInput } from '../common/validation/validate-input';
import type { CreateAnnouncementDto, UpdateAnnouncementDto } from './announcements.dto';
import { SecureMediaService } from '../common/media/secure-media.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditEntity } from '../common/audit/audit.constants';
import { entityIdNameSnapshot } from '../common/audit/audit-snapshots';

const announcementPhotosInclude = { photos: { orderBy: { sortOrder: 'asc' as const } } };

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entities: EntityChecksService,
    private readonly media: SecureMediaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      include: announcementPhotosInclude,
    });
  }

  async create(raw: CreateAnnouncementDto) {
    const input = validateInput(createAnnouncementSchema, raw);
    if (input.linkedFleetId) await this.entities.assertFleetExists(input.linkedFleetId);
    if (input.linkedBoatId) await this.entities.assertBoatExists(input.linkedBoatId);
    if (input.newBoatFleetId) await this.entities.assertFleetExists(input.newBoatFleetId);
    const title = input.title.trim();
    const navalBase = input.navalBase.trim();
    const photos = await this.media.processPresentationPhotos(
      input.presentationPhotos ?? [],
      input.coverPhotoIndex ?? 0,
    );
    const row = await this.prisma.announcement.create({
      data: {
        title,
        navalBase,
        status: (input.status ?? 'ACTIVE') as AnnouncementStatus,
        linkKind: input.linkKind as AnnouncementLinkKind,
        linkedFleetId: input.linkedFleetId ?? null,
        linkedBoatId: input.linkedBoatId ?? null,
        newFleetName: input.newFleetName ?? null,
        newBoatBrand: input.newBoatBrand ?? null,
        newBoatName: input.newBoatName ?? null,
        newBoatModel: input.newBoatModel ?? null,
        newBoatType: (input.newBoatType ?? null) as BoatType | null,
        newBoatMaxPassengers: input.newBoatMaxPassengers ?? null,
        newBoatFleetId: input.newBoatFleetId ?? null,
        photos: photos.length
          ? { create: photos.map((url, idx) => ({ url, sortOrder: idx })) }
          : undefined,
      },
      include: announcementPhotosInclude,
    });
    await this.audit.logCreate(AuditEntity.ANNOUNCEMENT, row.id, entityIdNameSnapshot(row));
    return row;
  }

  async update(id: string, raw: UpdateAnnouncementDto) {
    const input = validateInput(createAnnouncementSchema, raw);
    if (input.linkedFleetId) await this.entities.assertFleetExists(input.linkedFleetId);
    if (input.linkedBoatId) await this.entities.assertBoatExists(input.linkedBoatId);
    if (input.newBoatFleetId) await this.entities.assertFleetExists(input.newBoatFleetId);
    const existing = await this.prisma.announcement.findUnique({
      where: { id },
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!existing) throw new NotFoundException('Annonce introuvable.');
    const photos = await this.media.processPresentationPhotos(
      input.presentationPhotos ?? [],
      input.coverPhotoIndex ?? 0,
      { retainUrls: existing.photos.map((p) => p.url) },
    );
    const row = await this.prisma.announcement.update({
      where: { id },
      data: {
        title: input.title.trim(),
        navalBase: input.navalBase.trim(),
        status: (input.status ?? 'ACTIVE') as AnnouncementStatus,
        linkKind: input.linkKind as AnnouncementLinkKind,
        linkedFleetId: input.linkedFleetId ?? null,
        linkedBoatId: input.linkedBoatId ?? null,
        newFleetName: input.newFleetName ?? null,
        newBoatBrand: input.newBoatBrand ?? null,
        newBoatName: input.newBoatName ?? null,
        newBoatModel: input.newBoatModel ?? null,
        newBoatType: (input.newBoatType ?? null) as BoatType | null,
        newBoatMaxPassengers: input.newBoatMaxPassengers ?? null,
        newBoatFleetId: input.newBoatFleetId ?? null,
        photos: {
          deleteMany: { announcementId: id },
          create: photos.map((url, idx) => ({ url, sortOrder: idx })),
        },
      },
      include: announcementPhotosInclude,
    });
    await this.audit.logUpdate(
      AuditEntity.ANNOUNCEMENT,
      id,
      { title: existing.title, status: existing.status },
      { title: row.title, status: row.status },
    );
    return row;
  }

  async remove(id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Annonce introuvable.');
    await this.prisma.announcement.delete({ where: { id } });
    await this.audit.logDelete(AuditEntity.ANNOUNCEMENT, id, entityIdNameSnapshot(existing));
    return { ok: true as const };
  }
}
