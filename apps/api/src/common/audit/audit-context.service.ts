import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type AuditRequestContext = {
  userId?: string | null;
  ip?: string | null;
};

@Injectable()
export class AuditContextService {
  private readonly storage = new AsyncLocalStorage<AuditRequestContext>();

  run<T>(ctx: AuditRequestContext, fn: () => T): T {
    return this.storage.run(ctx, fn);
  }

  get(): AuditRequestContext {
    return this.storage.getStore() ?? {};
  }
}
