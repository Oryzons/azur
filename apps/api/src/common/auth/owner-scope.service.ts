import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, type AuthUser } from '@bleu-calanque/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OwnerScopeService {
  constructor(private readonly prisma: PrismaService) {}

  isOwner(user: Pick<AuthUser, 'role'>): boolean {
    return user.role === UserRole.OWNER;
  }

  async requireOwnerMemberId(user: Pick<AuthUser, 'id' | 'role' | 'ownerMemberId'>): Promise<string> {
    if (!this.isOwner(user)) {
      throw new ForbiddenException('Accès réservé aux propriétaires.');
    }
    if (user.ownerMemberId) return user.ownerMemberId;
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { ownerMemberId: true },
    });
    if (!row?.ownerMemberId) {
      throw new ForbiddenException('Compte propriétaire non lié à une fiche membre.');
    }
    return row.ownerMemberId;
  }

  async ownedBoatIds(user: Pick<AuthUser, 'id' | 'role' | 'ownerMemberId'>): Promise<string[]> {
    const memberId = await this.requireOwnerMemberId(user);
    const boats = await this.prisma.boat.findMany({
      where: { ownerMemberId: memberId },
      select: { id: true },
    });
    return boats.map((b) => b.id);
  }

  async assertBoatOwned(user: Pick<AuthUser, 'id' | 'role' | 'ownerMemberId'>, boatId: string): Promise<void> {
    const ids = await this.ownedBoatIds(user);
    if (!ids.includes(boatId)) {
      throw new ForbiddenException('Ce bateau ne fait pas partie de votre flotte.');
    }
  }

  async findOwnerUserIdsForBoat(boatId: string): Promise<string[]> {
    const boat = await this.prisma.boat.findUnique({
      where: { id: boatId },
      select: { ownerMemberId: true },
    });
    if (!boat?.ownerMemberId) return [];
    const users = await this.prisma.user.findMany({
      where: { ownerMemberId: boat.ownerMemberId, isActive: true, role: 'OWNER' },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async assertMemberIsOwner(memberId: string): Promise<void> {
    const m = await this.prisma.member.findUnique({ where: { id: memberId }, select: { role: true } });
    if (!m) throw new NotFoundException('Membre introuvable.');
    if (m.role !== 'OWNER') {
      throw new ForbiddenException('Seul un membre propriétaire peut recevoir un compte portail.');
    }
  }
}
