import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecureMediaService } from '../common/media/secure-media.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction, AuditEntity } from '../common/audit/audit.constants';
import { entityIdNameSnapshot } from '../common/audit/audit-snapshots';
import {
  buildNauticManagerImportPreview,
  type NauticManagerMappedClient,
} from '@bleu-calanque/shared';
import { ClientType, Civility, MemberRole } from '@prisma/client';
import type { CreateMemberDto, UpdateMemberDto } from './members.dto';

function trimOrThrow(v: string | null | undefined, label: string) {
  const x = (v ?? '').trim();
  if (!x) throw new BadRequestException(`${label} requis.`);
  return x;
}

function parseDateOrNull(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: SecureMediaService,
    private readonly audit: AuditService,
  ) {}

  private async secureDocumentUrls(input: CreateMemberDto | UpdateMemberDto) {
    const [cniFrontUrl, cniBackUrl, boatLicenseFrontUrl, boatLicenseBackUrl, airbusBadgePhotoUrl] =
      await Promise.all([
      this.media.processOptionalDocumentUrl(input.cniFrontUrl),
      this.media.processOptionalDocumentUrl(input.cniBackUrl),
      this.media.processOptionalDocumentUrl(input.boatLicenseFrontUrl),
      this.media.processOptionalDocumentUrl(input.boatLicenseBackUrl),
      this.media.processOptionalDocumentUrl(input.airbusBadgePhotoUrl),
    ]);
    return { cniFrontUrl, cniBackUrl, boatLicenseFrontUrl, boatLicenseBackUrl, airbusBadgePhotoUrl };
  }

  list() {
    return this.prisma.member.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(input: CreateMemberDto) {
    const firstName = trimOrThrow(input.firstName, 'Prénom');
    const lastName = trimOrThrow(input.lastName, 'Nom');
    const email = trimOrThrow(input.email, 'Email').toLowerCase();

    const exists = await this.prisma.member.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Un membre avec cet email existe déjà.');

    const docs = await this.secureDocumentUrls(input);

    const member = await this.prisma.member.create({
      data: {
        role: input.role as MemberRole,
        firstName,
        lastName,
        email,
        phone: input.phone ?? null,
        isActive: input.isActive ?? true,
        ownerSince: parseDateOrNull(input.ownerSince ?? null),
        ownerCompany: input.ownerCompany ?? null,
        ownerIban: input.ownerIban ?? null,
        ownerAddress: input.ownerAddress ?? null,
        clientType: (input.clientType ?? null) as ClientType | null,
        civility: (input.civility ?? null) as Civility | null,
        birthDate: parseDateOrNull(input.birthDate ?? null),
        nationality: input.nationality ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country ?? null,
        internalNote: input.internalNote ?? null,
        airbusBadge: input.airbusBadge?.trim() || null,
        clientIdNumber: input.clientIdNumber?.trim() || null,
        licenseNumber: input.licenseNumber?.trim() || null,
        ...docs,
        permManageMembers: Boolean(input.permManageMembers ?? false),
        permManageBoats: Boolean(input.permManageBoats ?? false),
        permManageReservations: Boolean(input.permManageReservations ?? false),
      },
    });
    await this.audit.logCreate(AuditEntity.MEMBER, member.id, {
      ...entityIdNameSnapshot({ id: member.id, email: member.email }),
      role: member.role,
    });
    return member;
  }

  async update(id: string, input: UpdateMemberDto) {
    const existing = await this.prisma.member.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Membre introuvable.');

    const firstName = trimOrThrow(input.firstName, 'Prénom');
    const lastName = trimOrThrow(input.lastName, 'Nom');
    const email = trimOrThrow(input.email, 'Email').toLowerCase();

    const conflict = await this.prisma.member.findFirst({
      where: { email, NOT: { id } },
    });
    if (conflict) throw new ConflictException('Un membre avec cet email existe déjà.');

    const docs = await this.secureDocumentUrls(input);

    const member = await this.prisma.member.update({
      where: { id },
      data: {
        role: input.role as MemberRole,
        firstName,
        lastName,
        email,
        phone: input.phone ?? null,
        isActive: input.isActive ?? true,
        ownerSince: parseDateOrNull(input.ownerSince ?? null),
        ownerCompany: input.ownerCompany ?? null,
        ownerIban: input.ownerIban ?? null,
        ownerAddress: input.ownerAddress ?? null,
        clientType: (input.clientType ?? null) as ClientType | null,
        civility: (input.civility ?? null) as Civility | null,
        birthDate: parseDateOrNull(input.birthDate ?? null),
        nationality: input.nationality ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country ?? null,
        internalNote: input.internalNote ?? null,
        airbusBadge: input.airbusBadge?.trim() || null,
        clientIdNumber: input.clientIdNumber?.trim() || null,
        licenseNumber: input.licenseNumber?.trim() || null,
        ...docs,
        permManageMembers: Boolean(input.permManageMembers ?? false),
        permManageBoats: Boolean(input.permManageBoats ?? false),
        permManageReservations: Boolean(input.permManageReservations ?? false),
      },
    });
    await this.audit.logUpdate(
      AuditEntity.MEMBER,
      id,
      { email: existing.email, role: existing.role, isActive: existing.isActive },
      { email: member.email, role: member.role, isActive: member.isActive },
    );
    return member;
  }

  async importNauticManagerCsv(csvText: string, dryRun: boolean) {
    const members = await this.prisma.member.findMany({ select: { email: true } });
    const existingEmails = members.map((m) => m.email);
    const { rows, parseError } = buildNauticManagerImportPreview(csvText, existingEmails);
    if (parseError) {
      return { parseError, summary: null, rows: [] as NauticManagerMappedClient[], errors: [] as string[] };
    }

    const summary = {
      total: rows.length,
      ready: rows.filter((r) => r.status === 'ready').length,
      existing: rows.filter((r) => r.status === 'existing').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
      duplicateInFile: rows.filter((r) => r.status === 'duplicate_in_file').length,
      created: 0,
      failed: 0,
    };

    if (dryRun) {
      return {
        parseError: null,
        summary,
        rows: rows.slice(0, 500),
        errors: [] as string[],
      };
    }

    const errors: string[] = [];
    const emailSet = new Set(existingEmails.map((e) => e.toLowerCase()));

    for (const row of rows) {
      if (row.status !== 'ready' || !row.email) continue;
      if (emailSet.has(row.email)) {
        summary.existing++;
        continue;
      }
      try {
        await this.prisma.member.create({
          data: {
            role: MemberRole.CLIENT,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone,
            isActive: true,
            clientType: (row.clientType ?? ClientType.PARTICULIER) as ClientType,
            civility: (row.civility ?? null) as Civility | null,
            birthDate: row.birthDate ? new Date(`${row.birthDate}T12:00:00.000Z`) : null,
            nationality: row.nationality,
            address: row.address,
            city: row.city,
            postalCode: row.postalCode,
            country: row.country,
            internalNote: row.internalNote,
          },
        });
        emailSet.add(row.email);
        summary.created++;
      } catch (err) {
        summary.failed++;
        const msg = err instanceof Error ? err.message : 'Erreur inconnue';
        errors.push(`Ligne ${row.line} (${row.email}) : ${msg}`);
      }
    }

    await this.audit.log({
      action: AuditAction.CREATE,
      entity: AuditEntity.MEMBER,
      entityId: 'nautic_manager_import',
      newData: { ...summary, dryRun: false },
    });

    return { parseError: null, summary, rows: [], errors: errors.slice(0, 50) };
  }

  async remove(id: string) {
    const existing = await this.prisma.member.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Membre introuvable.');
    await this.prisma.member.delete({ where: { id } });
    await this.audit.logDelete(AuditEntity.MEMBER, id, {
      ...entityIdNameSnapshot({ id: existing.id, email: existing.email }),
      role: existing.role,
    });
    return { ok: true as const };
  }
}
