import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditAction, AuditEntity } from '../common/audit/audit.constants';
import type {
  ActiveSessionUser,
  AuthTokens,
  AuthUser,
  LoginInput,
  RegisterInput,
} from '@bleu-calanque/shared';
import { UserRole } from '@bleu-calanque/shared';

/** Fenêtre d'activité pour considérer une session comme « en cours ». */
const ACTIVE_PRESENCE_MS = 30 * 60 * 1000;

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly presenceThrottle = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async register(
    input: RegisterInput,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<AuthTokens> {
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
        role: PrismaUserRole.STAFF,
      },
    });

    const tokens = await this.issueTokens(
      {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as UserRole,
        isActive: user.isActive,
      },
      meta,
    );

    await this.audit.log({
      action: AuditAction.REGISTER,
      entity: AuditEntity.AUTH,
      entityId: user.id,
      newData: { email: user.email },
      ctx: { userId: user.id, ip: meta.ip },
    });

    return tokens;
  }

  async login(input: LoginInput, meta: { ip?: string; userAgent?: string }): Promise<AuthTokens> {
    const email = input.email.trim().toLowerCase();
    const password = input.password.trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user?.isActive) {
      await this.audit.log({
        action: AuditAction.LOGIN_FAILED,
        entity: AuditEntity.AUTH,
        newData: { email },
        ctx: { ip: meta.ip },
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.audit.log({
        action: AuditAction.LOGIN_FAILED,
        entity: AuditEntity.AUTH,
        entityId: user.id,
        newData: { email },
        ctx: { ip: meta.ip },
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (e) {
      // SQLite peut timeouter si la base est verrouillée (plusieurs processus) : la connexion reste valide.
      this.logger.warn(`Impossible de mettre à jour lastLoginAt pour ${user.email} : ${(e as Error).message}`);
    }

    const tokens = await this.issueTokens(this.toThinUser(user), meta);
    await this.audit.log({
      action: AuditAction.LOGIN,
      entity: AuditEntity.AUTH,
      entityId: user.id,
      newData: { email: user.email },
      ctx: { userId: user.id, ip: meta.ip },
    });
    return tokens;
  }

  async refresh(token: string, meta: { ip?: string; userAgent?: string }): Promise<AuthTokens> {
    const hash = this.hashToken(token);
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (!row || row.revokedAt || row.expiresAt < new Date())
      throw new UnauthorizedException('Session invalide');
    if (!row.user.isActive) throw new UnauthorizedException('Compte désactivé');

    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(this.toThinUser(row.user), meta);
  }

  async logout(refreshToken: string, meta: { ip?: string } = {}): Promise<void> {
    const hash = this.hashToken(refreshToken);
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      select: { userId: true },
    });
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (row?.userId) {
      await this.audit.log({
        action: AuditAction.LOGOUT,
        entity: AuditEntity.AUTH,
        entityId: row.userId,
        ctx: { userId: row.userId, ip: meta.ip },
      });
    }
  }

  async validateUser(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user?.isActive) return null;
    void this.touchPresence(id);
    return this.toAuthUser(user);
  }

  /** Met à jour l'activité des sessions refresh encore valides (throttle ~1 min / utilisateur). */
  async touchPresence(userId: string): Promise<void> {
    const now = Date.now();
    const last = this.presenceThrottle.get(userId) ?? 0;
    if (now - last < 60_000) return;
    this.presenceThrottle.set(userId, now);
    try {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { lastSeenAt: new Date() },
      });
    } catch (e) {
      this.logger.warn(`touchPresence(${userId}): ${(e as Error).message}`);
    }
  }

  /** Comptes avec session en cours (admin, agent, propriétaire, bureau). */
  async listActiveSessions(): Promise<ActiveSessionUser[]> {
    const since = new Date(Date.now() - ACTIVE_PRESENCE_MS);
    const now = new Date();
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: now },
        lastSeenAt: { gte: since },
        user: {
          isActive: true,
          role: {
            in: [
              PrismaUserRole.ADMIN,
              PrismaUserRole.MANAGER,
              PrismaUserRole.STAFF,
              PrismaUserRole.AGENT,
              PrismaUserRole.OWNER,
            ],
          },
        },
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    const byUser = new Map<string, ActiveSessionUser & { _last: Date }>();
    for (const t of tokens) {
      const u = t.user;
      const seen = t.lastSeenAt;
      const existing = byUser.get(u.id);
      if (!existing) {
        byUser.set(u.id, {
          userId: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role as UserRole,
          lastSeenAt: seen.toISOString(),
          sessionCount: 1,
          _last: seen,
        });
      } else {
        existing.sessionCount += 1;
        if (seen > existing._last) {
          existing._last = seen;
          existing.lastSeenAt = seen.toISOString();
        }
      }
    }

    return [...byUser.values()]
      .map(({ _last, ...row }) => row)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  }

  private toThinUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    civility?: string | null;
    phone?: string | null;
    birthDate?: Date | null;
    nationality?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
    company?: string | null;
    avatarUrl?: string | null;
    role: string;
    ownerMemberId?: string | null;
    isActive: boolean;
    mustChangePassword?: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      civility: user.civility ?? null,
      phone: user.phone ?? null,
      birthDate: user.birthDate ? user.birthDate.toISOString() : null,
      nationality: user.nationality ?? null,
      address: user.address ?? null,
      city: user.city ?? null,
      postalCode: user.postalCode ?? null,
      country: user.country ?? null,
      company: user.company ?? null,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role as UserRole,
      ownerMemberId: user.ownerMemberId ?? null,
      isActive: user.isActive,
      mustChangePassword: Boolean(user.mustChangePassword),
    };
  }

  private toAuthUser(u: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    civility?: string | null;
    phone?: string | null;
    birthDate?: Date | null;
    nationality?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
    company?: string | null;
    avatarUrl?: string | null;
    role: string;
    ownerMemberId?: string | null;
    isActive: boolean;
    mustChangePassword?: boolean;
  }): AuthUser {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      civility: u.civility ?? null,
      phone: u.phone ?? null,
      birthDate: u.birthDate ? u.birthDate.toISOString() : null,
      nationality: u.nationality ?? null,
      address: u.address ?? null,
      city: u.city ?? null,
      postalCode: u.postalCode ?? null,
      country: u.country ?? null,
      company: u.company ?? null,
      avatarUrl: u.avatarUrl ?? null,
      role: u.role as UserRole,
      ownerMemberId: u.ownerMemberId ?? null,
      isActive: u.isActive,
      mustChangePassword: Boolean(u.mustChangePassword),
    };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private parseTtlDays(ttl: string): number {
    const m = ttl.match(/^(\d+)([smhd])$/);
    if (!m) return 7;
    const n = parseInt(m[1]!, 10);
    switch (m[2]) {
      case 'd':
        return n;
      case 'h':
        return n / 24;
      case 'm':
        return n / (60 * 24);
      default:
        return n / (3600 * 24);
    }
  }

  private async issueTokens(
    user: { id: string; email: string; role: UserRole; firstName: string; lastName: string; isActive: boolean },
    meta: { ip?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = await this.jwt.signAsync(payload);

    const refreshRaw = randomBytes(48).toString('hex');
    const refreshHash = this.hashToken(refreshRaw);
    const days = this.parseTtlDays(this.config.get<string>('JWT_REFRESH_TTL', '7d'));
    const expiresAt = new Date(Date.now() + Math.max(days, 1 / 24) * 86400000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshHash,
        expiresAt,
        lastSeenAt: new Date(),
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
      },
    });

    return {
      accessToken,
      refreshToken: refreshRaw,
      user: this.toThinUser(user),
    };
  }
}
