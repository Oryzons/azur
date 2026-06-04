import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditContextInterceptor } from './audit-context.interceptor';
import { AuditContextService } from './audit-context.service';
import { AuditService } from './audit.service';

@Global()
@Module({
  providers: [
    AuditContextService,
    AuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditContextInterceptor,
    },
  ],
  exports: [AuditService, AuditContextService],
})
export class AuditModule {}
