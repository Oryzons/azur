import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EntityChecksService {
  constructor(private readonly prisma: PrismaService) {}

  async assertBoatExists(boatId: string): Promise<void> {
    const row = await this.prisma.boat.findUnique({ where: { id: boatId }, select: { id: true } });
    if (!row) throw new BadRequestException('Bateau introuvable.');
  }

  async assertMemberExists(memberId: string): Promise<void> {
    const row = await this.prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
    if (!row) throw new BadRequestException('Membre client introuvable.');
  }

  async assertExtrasExist(extraIds: string[]): Promise<void> {
    if (extraIds.length === 0) return;
    const unique = [...new Set(extraIds)];
    const rows = await this.prisma.extra.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    if (rows.length !== unique.length) {
      throw new BadRequestException('Un ou plusieurs extras sont invalides.');
    }
  }

  async assertFleetExists(fleetId: string): Promise<void> {
    const row = await this.prisma.fleet.findUnique({ where: { id: fleetId }, select: { id: true } });
    if (!row) throw new BadRequestException('Flotille introuvable.');
  }

  async assertCouponCodeValid(code: string | null | undefined): Promise<void> {
    if (!code?.trim()) return;
    const normalized = code.replaceAll(/\s+/g, '').toUpperCase();
    const coupon = await this.prisma.coupon.findFirst({
      where: { code: normalized, enabled: true },
      select: { id: true, validFrom: true, validUntil: true },
    });
    if (!coupon) throw new BadRequestException('Code coupon invalide ou inactif.');
    const now = new Date();
    if (coupon.validFrom > now) throw new BadRequestException('Code coupon pas encore valide.');
    if (coupon.validUntil && coupon.validUntil < now) {
      throw new BadRequestException('Code coupon expiré.');
    }
  }
}
