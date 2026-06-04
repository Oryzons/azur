import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '@bleu-calanque/shared';
import { Observable } from 'rxjs';
import { AuditContextService } from './audit-context.service';
import { clientIp } from './client-ip';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly auditContext: AuditContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const userId = req.user?.id ?? null;
    const ip = clientIp(req) ?? null;
    return new Observable((subscriber) => {
      this.auditContext.run({ userId, ip }, () => {
        next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
