import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction, type AuditActionType, type AuditEntityType } from './audit.constants';
import { AuditContextService, type AuditRequestContext } from './audit-context.service';
import { toAuditJson } from './audit-sanitize';

export type AuditLogInput = {
  action: AuditActionType | string;
  entity: AuditEntityType | string;
  entityId?: string | null;
  oldData?: unknown;
  newData?: unknown;
  ctx?: AuditRequestContext;
};

@Injectable()
export class AuditService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditService.name);
  private retentionDays = 60;
  private purgeTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditContext: AuditContextService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.retentionDays = this.config.get<number>('AUDIT_RETENTION_DAYS', 60);
    void this.purgeExpired();
    this.purgeTimer = setInterval(() => void this.purgeExpired(), 24 * 60 * 60 * 1000);
    this.logger.log(`Audit logs — rétention ${this.retentionDays} jour(s)`);
  }

  onModuleDestroy() {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
  }

  async log(input: AuditLogInput): Promise<void> {
    const ctx = { ...this.auditContext.get(), ...input.ctx };
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: ctx.userId ?? null,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          oldData: toAuditJson(input.oldData),
          newData: toAuditJson(input.newData),
          ip: ctx.ip ?? null,
        },
      });
    } catch (e) {
      this.logger.error(`Échec écriture audit (${input.action}/${input.entity}): ${(e as Error).message}`);
    }
  }

  async logCreate(entity: AuditEntityType | string, entityId: string, newData: unknown) {
    await this.log({ action: AuditAction.CREATE, entity, entityId, newData });
  }

  async logUpdate(
    entity: AuditEntityType | string,
    entityId: string,
    oldData: unknown,
    newData: unknown,
  ) {
    await this.log({ action: AuditAction.UPDATE, entity, entityId, oldData, newData });
  }

  async logDelete(entity: AuditEntityType | string, entityId: string, oldData: unknown) {
    await this.log({ action: AuditAction.DELETE, entity, entityId, oldData });
  }

  async logStatusChange(
    entity: AuditEntityType | string,
    entityId: string,
    from: string,
    to: string,
    extra?: Record<string, unknown>,
  ) {
    await this.log({
      action: AuditAction.STATUS_CHANGE,
      entity,
      entityId,
      oldData: { status: from, ...extra },
      newData: { status: to, ...extra },
    });
  }

  /** Supprime les entrées plus anciennes que la rétention configurée. */
  async purgeExpired(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);
    try {
      const result = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (result.count > 0) {
        this.logger.log(`${result.count} entrée(s) d’audit supprimée(s) (avant ${cutoff.toISOString()})`);
      }
      return result.count;
    } catch (e) {
      this.logger.warn(`Purge audit impossible : ${(e as Error).message}`);
      return 0;
    }
  }
}
