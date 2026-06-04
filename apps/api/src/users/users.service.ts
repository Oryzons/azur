import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecureMediaService } from '../common/media/secure-media.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction, AuditEntity } from '../common/audit/audit.constants';
import bcrypt from 'bcryptjs';
import type {
  CreateOwnerUserInput,
  CreateStaffUserInput,
  ResetOwnerPortalPasswordInput,
  UpdateProfileInput,
} from '@bleu-calanque/shared';
import { UserRole } from '@bleu-calanque/shared';
import { OwnerScopeService } from '../common/auth/owner-scope.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: SecureMediaService,
    private readonly audit: AuditService,
    private readonly ownerScope: OwnerScopeService,
  ) {}

  async createOwnerPortalUser(input: CreateOwnerUserInput) {
    await this.ownerScope.assertMemberIsOwner(input.memberId);
    const member = await this.prisma.member.findUnique({ where: { id: input.memberId } });
    if (!member) throw new NotFoundException('Membre introuvable.');

    const email = input.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email déjà utilisé');

    const linked = await this.prisma.user.findFirst({
      where: { ownerMemberId: input.memberId },
    });
    if (linked) throw new ConflictException('Un compte portail existe déjà pour ce propriétaire.');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: member.firstName,
        lastName: member.lastName,
        role: 'OWNER',
        ownerMemberId: input.memberId,
        mustChangePassword: Boolean(input.mustChangePassword ?? true),
      },
    });
    await this.audit.logCreate(AuditEntity.USER, user.id, {
      email: user.email,
      role: user.role,
      ownerMemberId: input.memberId,
    });
    return user;
  }

  async resetOwnerPortalPassword(memberId: string, input: ResetOwnerPortalPasswordInput) {
    await this.ownerScope.assertMemberIsOwner(memberId);
    const user = await this.prisma.user.findFirst({
      where: { ownerMemberId: memberId, role: 'OWNER' },
    });
    if (!user) throw new NotFoundException('Aucun compte portail pour ce propriétaire.');

    const password = input.password.trim();
    if (password.length < 8) {
      throw new ConflictException('Le mot de passe doit faire au moins 8 caractères.');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: Boolean(input.mustChangePassword ?? true),
      },
    });
    await this.audit.log({
      action: AuditAction.PASSWORD_CHANGE,
      entity: AuditEntity.USER,
      entityId: user.id,
      newData: { ownerMemberId: memberId, resetByAdmin: true },
    });
    return updated;
  }

  async createStaffUser(input: CreateStaffUserInput) {
    const email = input.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email déjà utilisé');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role satisfies UserRole,
        mustChangePassword: Boolean(input.mustChangePassword ?? true),
      },
    });
    await this.audit.logCreate(AuditEntity.USER, user.id, { email: user.email, role: user.role });
    return user;
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    return user;
  }

  async changeMyPassword(userId: string, input: { currentPassword: string; newPassword: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();

    const currentPassword = input.currentPassword.trim();
    const newPassword = input.newPassword.trim();
    if (newPassword.length < 8) {
      throw new BadRequestException('Le nouveau mot de passe doit faire au moins 8 caractères.');
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Mot de passe actuel incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    await this.audit.log({
      action: AuditAction.PASSWORD_CHANGE,
      entity: AuditEntity.USER,
      entityId: userId,
    });
    return updated;
  }

  async updateMe(userId: string, input: UpdateProfileInput) {
    let birthDate: Date | null | undefined;
    if (input.birthDate === undefined) birthDate = undefined;
    else if (input.birthDate === null) birthDate = null;
    else birthDate = new Date(input.birthDate);

    const avatarUrl =
      input.avatarUrl !== undefined
        ? await this.media.processOptionalImageUrl(input.avatarUrl)
        : undefined;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        civility: input.civility ?? undefined,
        firstName: input.firstName ?? undefined,
        lastName: input.lastName ?? undefined,
        phone: input.phone ?? undefined,
        birthDate,
        nationality: input.nationality ?? undefined,
        address: input.address ?? undefined,
        city: input.city ?? undefined,
        postalCode: input.postalCode ?? undefined,
        country: input.country ?? undefined,
        company: input.company ?? undefined,
        avatarUrl,
      },
    });
    return user;
  }
}

